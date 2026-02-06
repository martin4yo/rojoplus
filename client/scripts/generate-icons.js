import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const inputPath = path.join(__dirname, '../public/images/logo.png')
const outputDir = path.join(__dirname, '../public/images')

async function generateIcons() {
  try {
    console.log('Generating PWA icons from logo.png...')

    // Generate 192x192 icon
    await sharp(inputPath)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-192.png'))
    console.log('Created icon-192.png')

    // Generate 512x512 icon
    await sharp(inputPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-512.png'))
    console.log('Created icon-512.png')

    console.log('PWA icons generated successfully!')
  } catch (error) {
    console.error('Error generating icons:', error)
    process.exit(1)
  }
}

generateIcons()
