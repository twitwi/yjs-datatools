"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const process_1 = __importDefault(require("process"));
const fs_1 = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../index");
// box url is passed as first parameter, local output directory as second
// connect to the box, recursively extract all text files and save them to the output directory
const boxUrl = process_1.default.argv[2].includes('@') ? process_1.default.argv[2] : `${process_1.default.argv[2]}/@`;
const outputDir = process_1.default.argv[3];
if (!boxUrl || !outputDir) {
    console.error('Usage: .... <box-url> <output-dir>');
    process_1.default.exit(1);
}
async function main() {
    const ret = (0, index_1.setupYjsByConfig)(boxUrl, { websocket: true, indexeddb: false });
    await (0, index_1.syncedAndConnected)(ret);
    const { ydoc } = ret;
    // check box existence
    const box = await (0, index_1.getYBoxFor)(ydoc, ret.parsed.path);
    if (!box) {
        console.error('Box not found at path', ret.parsed.path);
        process_1.default.exit(1);
    }
    console.log('Box found, extracting...');
    // recursively extract text files in the box and save to output directory
    async function extractBox(box, inode, currentPath) {
        const node = box.get(inode);
        const type = node.get('type');
        if (type === 'text') {
            const content = node.get('content');
            const text = content.toString();
            const filePath = path_1.default.join(outputDir, currentPath);
            await fs_1.default.promises.mkdir(path_1.default.dirname(filePath), { recursive: true });
            await fs_1.default.promises.writeFile(filePath, text, 'utf-8');
        }
        else if (type === 'binary') { // actually saved as a b64 string in Y.Text, we can decode it and save as binary file
            const content = node.get('content');
            const b64 = content.toString();
            const buffer = Buffer.from(b64, 'base64');
            const filePath = path_1.default.join(outputDir, currentPath);
            await fs_1.default.promises.mkdir(path_1.default.dirname(filePath), { recursive: true });
            await fs_1.default.promises.writeFile(filePath, buffer);
        }
        else if (type === 'directory') {
            const children = node.get('children');
            for (const [name, subk] of children) {
                await extractBox(box, subk, path_1.default.join(currentPath, name));
            }
        }
        else if (type === 'deleted') {
            // skip deleted nodes
            // console.warn(`Skipping deleted node at ${currentPath} (TODO maybe an option to recover deleted nodes)`)
        }
        else {
            console.warn(`Unknown box type at ${currentPath}:`, type);
        }
    }
    (0, fs_1.mkdir)(outputDir, { recursive: true }, (err) => {
        if (err) {
            console.error('Failed to create output directory', outputDir, err);
            process_1.default.exit(1);
        }
    });
    await extractBox(box, 'root:', '');
    console.log('Extraction complete, output saved to', outputDir);
    process_1.default.exit(0);
}
main().catch((err) => {
    console.error(err);
    process_1.default.exit(1);
});
