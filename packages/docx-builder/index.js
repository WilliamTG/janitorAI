const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildParagraph(text, { bold = false, size = 22 } = {}) {
  const safeText = typeof text === 'string' ? text : '';
  const lines = safeText.split(/\r?\n/);

  const runProps = [];
  if (bold) {
    runProps.push('<w:b/>');
  }
  if (size) {
    runProps.push(`<w:sz w:val="${size}"/>`, `<w:szCs w:val="${size}"/>`);
  }

  const runPropXml = runProps.length ? `<w:rPr>${runProps.join('')}</w:rPr>` : '';

  const runs = lines
    .map((line, index) => {
      const textNode = `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`;
      const lineBreak = index < lines.length - 1 ? '<w:br/>' : '';
      return `<w:r>${runPropXml}${textNode}</w:r>${lineBreak}`;
    })
    .join('');

  return `<w:p>${runs}</w:p>`;
}

async function zipDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const zip = spawn('zip', ['-rq', outputPath, '.'], { cwd: sourceDir });
    zip.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`zip command failed with code ${code}`));
      }
    });
    zip.on('error', (err) => reject(err));
  });
}

async function createDocxBuffer({ title, subtitle, paragraphs }) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'report-docx-'));
  const relsDir = path.join(tempDir, '_rels');
  const wordDir = path.join(tempDir, 'word');

  try {
    await fs.promises.mkdir(relsDir, { recursive: true });
    await fs.promises.mkdir(wordDir, { recursive: true });

    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const docParagraphs = [
      buildParagraph(title || 'Inspection Report', { bold: true, size: 36 }),
      buildParagraph(subtitle || '', { size: 22 }),
      ...(paragraphs || []).map((p) => buildParagraph(p, { size: 22 })),
    ].join('\n');

    const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${docParagraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    await fs.promises.writeFile(path.join(tempDir, '[Content_Types].xml'), contentTypes);
    await fs.promises.writeFile(path.join(relsDir, '.rels'), rels);
    await fs.promises.writeFile(path.join(wordDir, 'document.xml'), documentXml);

    const docxPath = path.join(tempDir, 'report.docx');
    await zipDirectory(tempDir, docxPath);

    const buffer = await fs.promises.readFile(docxPath);
    return buffer;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

module.exports = { createDocxBuffer };
