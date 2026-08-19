import fs from 'fs'

const html = fs.readFileSync('data/aipn-quotes.json', 'utf8')
const idx = html.indexOf('Sen. Jim Banks')
console.log('idx', idx)
console.log(JSON.stringify(html.slice(idx - 10, idx + 120)))

const red = String.fromCodePoint(0x1f534)
const blue = String.fromCodePoint(0x1f535)
console.log('red in html', html.includes(red), 'blue', html.includes(blue))

// try finding quote arrays
const start = html.indexOf(red + ' Sen.')
console.log('start', start)
if (start > 0) console.log(JSON.stringify(html.slice(start - 2, start + 80)))

const countRed = html.split(red).length - 1
const countBlue = html.split(blue).length - 1
console.log({ countRed, countBlue })

// Find JS assignment
const marker = 'const quotes'
const m2 = html.indexOf('quotes =')
console.log('quotes =', m2)
const m3 = html.search(/var\s+\w*[Qq]uotes/)
console.log('var quotes', m3)

// Look at script around first quote
const lineNo = html.slice(0, idx).split('\n').length
console.log('approx line', lineNo)
const lines = html.split('\n')
console.log('line length', lines[lineNo - 1]?.length)
console.log('prev line start', lines[lineNo - 2]?.slice(0, 100))
