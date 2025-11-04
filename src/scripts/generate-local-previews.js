const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

loadEnvFile();

const VALID_TYPES = ["portfolio", "events"];
const PREVIEW_SUFFIX = "_preview";
const IMAGE_PATTERN = /\.(jpe?g|png)$/i;
const DEFAULT_ROOT = process.env.R2_UPLOADS_DIR || "uploads";
const CONCURRENCY = Math.max(2, Math.floor(os.cpus().length / 2));

function loadEnvFile() {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const sep = trimmed.indexOf("=");
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        const value = trimmed.slice(sep + 1).trim();
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dir: DEFAULT_ROOT,
        type: null,
        folder: null,
        force: false
    };

    for (let i = 0; i < args.length; i += 1) {
        const token = args[i];
        switch (token) {
            case "--dir":
            case "-d":
                options.dir = args[++i];
                break;
            case "--type":
            case "-t":
                options.type = args[++i];
                break;
            case "--folder":
            case "-f":
                options.folder = args[++i];
                break;
            case "--force":
                options.force = true;
                break;
            case "--help":
            case "-h":
                printUsage();
                process.exit(0);
            default:
                if (token && token.startsWith("-")) {
                    throw new Error(`Unknown flag: ${token}`);
                }
        }
    }

    if (options.type && !VALID_TYPES.includes(options.type)) {
        throw new Error(`Invalid --type value. Expected one of: ${VALID_TYPES.join(", ")}`);
    }

    if (options.folder && !options.type) {
        throw new Error("--folder requires --type to be specified.");
    }

    return options;
}

function printUsage() {
    console.log(`
Usage: node src/scripts/generate-local-previews.js [options]

Options:
  --dir, -d     Root directory containing staged galleries (default: ${DEFAULT_ROOT})
  --type, -t    Limit processing to a single type (${VALID_TYPES.join(" | ")})
  --folder, -f  Limit processing to a specific folder (requires --type)
  --force       Regenerate previews even if they already exist
  --help, -h    Show this help message
`);
}

function listGalleries(root, type) {
    const typeDir = path.join(root, type);
    if (!fs.existsSync(typeDir) || !fs.lstatSync(typeDir).isDirectory()) {
        return [];
    }

    return fs
        .readdirSync(typeDir)
        .filter(entry => {
            const fullPath = path.join(typeDir, entry);
            return fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory();
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function collectImages(directory, force) {
    if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory()) {
        return [];
    }

    return fs
        .readdirSync(directory)
        .filter(file => IMAGE_PATTERN.test(file))
        .filter(file => {
            if (force) return true;
            const base = path.basename(file, path.extname(file));
            const previewPath = path.join(directory, `${base}${PREVIEW_SUFFIX}.webp`);
            return !fs.existsSync(previewPath);
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function resizeOptionsForType(type) {
    if (type === "events") {
        return { height: 400, fit: "inside", withoutEnlargement: true };
    }
    return { width: 800, fit: "inside", withoutEnlargement: true };
}

async function generatePreview(inputPath, outputPath, type) {
    await sharp(inputPath)
        .resize(resizeOptionsForType(type))
        .webp({
            quality: 80,
            effort: 6,
            lossless: false,
            smartSubsample: true
        })
        .toFile(outputPath);
}

async function runJobs(jobs) {
    let index = 0;
    async function worker() {
        while (index < jobs.length) {
            const job = jobs[index++];
            await job();
        }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker);
    await Promise.all(workers);
}

async function processFolder(type, folder, root, options) {
    const folderPath = path.join(root, type, folder);
    const images = collectImages(folderPath, options.force);
    if (images.length === 0) {
        console.log(`\n[skip] ${type}/${folder} has no images requiring previews.`);
        return { generated: 0, skipped: 0 };
    }

    console.log(`\nProcessing ${type}/${folder}`);

    const jobs = images.map(filename => {
        const base = path.basename(filename, path.extname(filename));
        const previewName = `${base}${PREVIEW_SUFFIX}.webp`;
        const inputPath = path.join(folderPath, filename);
        const outputPath = path.join(folderPath, previewName);

        return async () => {
            if (!options.force && fs.existsSync(outputPath)) {
                return;
            }
            console.log(`  → ${previewName}`);
            await generatePreview(inputPath, outputPath, type);
        };
    });

    await runJobs(jobs);
    return { generated: jobs.length, skipped: 0 };
}

async function main() {
    const options = parseArgs();
    const rootDir = path.resolve(process.cwd(), options.dir);

    if (!fs.existsSync(rootDir) || !fs.lstatSync(rootDir).isDirectory()) {
        throw new Error(`Root directory not found: ${rootDir}`);
    }

    const types = options.type ? [options.type] : VALID_TYPES;
    let totalGenerated = 0;
    let processedFolders = 0;

    for (const type of types) {
        const folders = listGalleries(rootDir, type).filter(folder => {
            if (!options.folder) return true;
            return options.folder === folder;
        });

        if (folders.length === 0) {
            console.log(`[skip] No ${type} folders found under ${rootDir}`);
            continue;
        }

        for (const folder of folders) {
            const result = await processFolder(type, folder, rootDir, options);
            totalGenerated += result.generated;
            processedFolders += 1;
        }
    }

    if (processedFolders === 0) {
        console.log("No matching galleries found. Nothing to do.");
    } else {
        console.log(
            `\nDone. Processed ${processedFolders} folders; generated ${totalGenerated} preview(s).`
        );
    }
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});
