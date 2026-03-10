
import process from 'process'
import fs, { mkdir } from 'fs'
import path from 'path'
import { setupYjsByConfig, syncedAndConnected, getYBoxFor } from '../index'
import { YMap, YText } from '../ytools'

// box url is passed as first parameter, local output directory as second
// connect to the box, recursively extract all text files and save them to the output directory
const boxUrl = process.argv[2].includes('@') ? process.argv[2] : `${process.argv[2]}/@`
const outputDir = process.argv[3]

if (!boxUrl || !outputDir) {
  console.error('Usage: .... <box-url> <output-dir>')
  process.exit(1)
}

async function main() {
  const ret = setupYjsByConfig(boxUrl, { websocket: true, indexeddb: false })
  await syncedAndConnected(ret)
  const { ydoc } = ret
  // check box existence
  const box = await getYBoxFor(ydoc, ret.parsed.path)
  if (!box) {
    console.error('Box not found at path', ret.parsed.path)
    process.exit(1)
  }
  console.log('Box found, extracting...')

  // recursively extract text files in the box and save to output directory
  async function extractBox(box: YMap<YMap<any>>, inode: string, currentPath: string) {
    const node = box.get(inode) as YMap<any>
    const type = node.get('type')
    if (type === 'text') {
      const content = node.get('content') as YText
      const text = content.toString()
      const filePath = path.join(outputDir, currentPath)
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, text, 'utf-8')
    } else if (type === 'binary') { // actually saved as a b64 string in Y.Text, we can decode it and save as binary file
      const content = node.get('content') as YText
      const b64 = content.toString()
      const buffer = Buffer.from(b64, 'base64')
      const filePath = path.join(outputDir, currentPath)
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, buffer)
    } else if (type === 'directory') {
      const children = node.get('children') as YMap<string>
      for (const [name, subk] of children) {
        await extractBox(box, subk, path.join(currentPath, name))
      }
    } else if (type === 'deleted') {
        // skip deleted nodes
        // console.warn(`Skipping deleted node at ${currentPath} (TODO maybe an option to recover deleted nodes)`)
    } else {
      console.warn(`Unknown box type at ${currentPath}:`, type)
    }
  }

  mkdir(outputDir, { recursive: true }, (err) => {
    if (err) {
      console.error('Failed to create output directory', outputDir, err)
      process.exit(1)
    }
  })
  await extractBox(box, 'root:', '')

  console.log('Extraction complete, output saved to', outputDir)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

