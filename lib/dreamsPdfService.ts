import PDFDocument from 'pdfkit'

const PURPLE = '#6B46C1'
const PURPLE_LIGHT = '#EDE9FE'
const DARK = '#1A1A2E'
const GRAY = '#6B7280'
const GREEN = '#059669'
const YELLOW = '#D97706'
const RED = '#DC2626'
const PAGE_MARGIN = 50

function scoreColor(score: number): string {
  if (score >= 70) return GREEN
  if (score >= 50) return YELLOW
  return RED
}

function addHeader(doc: InstanceType<typeof PDFDocument>, title: string, subtitle: string, userName: string, sessionDate: Date) {
  doc.rect(0, 0, doc.page.width, 80).fill(PURPLE)
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
    .text('Transpersonal International', PAGE_MARGIN, 18)
  doc.fontSize(10).font('Helvetica')
    .text(title, PAGE_MARGIN, 44)
  const dateStr = sessionDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(userName + ' - ' + dateStr, PAGE_MARGIN, 58, { align: 'left' })
  doc.fillColor(DARK)
  doc.moveDown(2)
  doc.fontSize(14).font('Helvetica-Bold').fillColor(PURPLE).text(subtitle, PAGE_MARGIN, 100)
  doc.moveDown(0.5)
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).strokeColor(PURPLE_LIGHT).stroke()
  doc.moveDown(0.8)
  doc.fillColor(DARK)
}

function addFooter(doc: InstanceType<typeof PDFDocument>) {
  const range = (doc as any).bufferedPageRange?.()
  const pageCount = range ? range.count : 1
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)
    doc.fontSize(8).fillColor(GRAY)
      .text(
        'Transpersonal International - Pagina ' + (i + 1) + ' de ' + pageCount,
        PAGE_MARGIN,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - PAGE_MARGIN * 2 }
      )
  }
}

export async function generateSupervisorTranscriptPdf(data: {
  userName: string
  sessionDate: Date
  durationMinutes?: number
  messages: Array<{ role: 'terapeuta' | 'supervisor'; content: string; createdAt?: string }>
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    addHeader(doc, 'Transcricao de Sessao - Supervisor IA', 'Transcricao da Sessao', data.userName, data.sessionDate)

    if (data.durationMinutes) {
      doc.fontSize(9).fillColor(GRAY).text('Duracao: ' + data.durationMinutes + ' min', { continued: false })
      doc.moveDown(0.3)
    }
    doc.fontSize(9).fillColor(GRAY).text(data.messages.length + ' mensagens', { continued: false })
    doc.moveDown(1)

    for (const msg of data.messages) {
      const roleLabel = msg.role === 'terapeuta' ? 'Terapeuta' : 'Supervisor IA'
      const roleColor = msg.role === 'terapeuta' ? PURPLE : GRAY

      if (doc.y > doc.page.height - 120) doc.addPage()

      doc.fontSize(9).font('Helvetica-Bold').fillColor(roleColor).text(roleLabel, PAGE_MARGIN, doc.y)
      doc.moveDown(0.2)
      doc.fontSize(10).font('Helvetica').fillColor(DARK)
        .text(msg.content, PAGE_MARGIN + 12, doc.y, {
          width: doc.page.width - PAGE_MARGIN * 2 - 12,
          lineGap: 2,
        })
      doc.moveDown(0.8)
    }

    addFooter(doc)
    doc.end()
  })
}

export async function generateSupervisorReportPdf(data: {
  userName: string
  sessionDate: Date
  report: {
    overallScore: number
    summary?: string
    metodoAplicado?: { score: number; feedback: string }
    perguntasSocraticas?: { score: number; feedback: string }
    evitouInterpretacaoDirecta?: { score: number; feedback: string }
    exploracaoElementosSonho?: { score: number; feedback: string }
    ligacaoVidaConcreta?: { score: number; feedback: string }
    linguagemTerapeutica?: { score: number; feedback: string }
    pontosFortesObservados?: string[]
    areasMelhoria?: string[]
    proximosPassos?: string
  }
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    addHeader(doc, 'Relatorio de Desempenho - Sessao de Supervisao', 'Relatorio de Desempenho', data.userName, data.sessionDate)

    const { report } = data
    const sc = scoreColor(report.overallScore)

    doc.fontSize(36).font('Helvetica-Bold').fillColor(sc)
      .text(String(report.overallScore), PAGE_MARGIN, doc.y, { continued: true })
    doc.fontSize(14).font('Helvetica').fillColor(GRAY).text('/100  Pontuacao Global', { continued: false })
    doc.moveDown(0.6)

    if (report.summary) {
      doc.fontSize(11).font('Helvetica').fillColor(DARK)
        .text(report.summary, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 3 })
      doc.moveDown(1)
    }

    type DimKey = 'metodoAplicado' | 'perguntasSocraticas' | 'evitouInterpretacaoDirecta' | 'exploracaoElementosSonho' | 'ligacaoVidaConcreta' | 'linguagemTerapeutica'
    const DIMENSOES: Array<{ key: DimKey; label: string }> = [
      { key: 'metodoAplicado', label: 'Metodo Aplicado' },
      { key: 'perguntasSocraticas', label: 'Perguntas Socraticas' },
      { key: 'evitouInterpretacaoDirecta', label: 'Evitou Interpretacao Directa' },
      { key: 'exploracaoElementosSonho', label: 'Exploracao dos Elementos do Sonho' },
      { key: 'ligacaoVidaConcreta', label: 'Ligacao a Vida Concreta' },
      { key: 'linguagemTerapeutica', label: 'Linguagem Terapeutica' },
    ]

    doc.fontSize(11).font('Helvetica-Bold').fillColor(PURPLE).text('Dimensoes Avaliadas')
    doc.moveDown(0.4)

    for (const { key, label } of DIMENSOES) {
      const dim = report[key]
      if (!dim) continue
      if (doc.y > doc.page.height - 120) doc.addPage()

      const s = Math.min(100, Math.max(0, dim.score ?? 0))
      const c = scoreColor(s)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(label, PAGE_MARGIN, doc.y, { continued: true })
      doc.fillColor(c).text('  ' + s + '/100', { continued: false })
      const barY = doc.y + 2
      const barWidth = doc.page.width - PAGE_MARGIN * 2
      doc.rect(PAGE_MARGIN, barY, barWidth, 5).fill('#E5E7EB')
      doc.rect(PAGE_MARGIN, barY, barWidth * (s / 100), 5).fill(c)
      doc.moveDown(0.6)
      if (dim.feedback) {
        doc.fontSize(9).font('Helvetica').fillColor(GRAY)
          .text(dim.feedback, PAGE_MARGIN + 8, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 - 8, lineGap: 2 })
      }
      doc.moveDown(0.8)
    }

    if (report.pontosFortesObservados?.length) {
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(GREEN).text('Pontos Fortes')
      doc.moveDown(0.3)
      for (const item of report.pontosFortesObservados) {
        doc.fontSize(10).font('Helvetica').fillColor(DARK).text('v  ' + item, PAGE_MARGIN, doc.y, { lineGap: 2 })
        doc.moveDown(0.3)
      }
      doc.moveDown(0.5)
    }

    if (report.areasMelhoria?.length) {
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(YELLOW).text('Areas a Melhorar')
      doc.moveDown(0.3)
      for (const item of report.areasMelhoria) {
        doc.fontSize(10).font('Helvetica').fillColor(DARK).text('->  ' + item, PAGE_MARGIN, doc.y, { lineGap: 2 })
        doc.moveDown(0.3)
      }
      doc.moveDown(0.5)
    }

    if (report.proximosPassos) {
      if (doc.y > doc.page.height - 100) doc.addPage()
      doc.rect(PAGE_MARGIN, doc.y, doc.page.width - PAGE_MARGIN * 2, 4).fill(PURPLE_LIGHT)
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica-Bold').fillColor(PURPLE).text('Proximos Passos')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica').fillColor(DARK)
        .text(report.proximosPassos, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 3 })
    }

    addFooter(doc)
    doc.end()
  })
}

export async function generateAvatarReportPdf(data: {
  userName: string
  avatarName: string
  sessionDate: Date
  report: {
    overallScore?: number
    summary?: string
    abordagemSocratica?: { score: number; feedback: string }
    escutaAtiva?: { score: number; feedback: string }
    respeitoSimbologiaPessoal?: { score: number; feedback: string }
    evitouInterpretacaoDirecta?: { score: number; feedback: string }
    criouEspacoSeguro?: { score: number; feedback: string }
    progressoComAvatar?: { score: number; feedback: string }
    techniquesDetected?: string[]
    strengths?: string[]
    improvements?: string[]
    criticalErrors?: string[]
    nextSteps?: string
  }
  transcript?: string[]
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    addHeader(
      doc,
      'Relatorio de Desempenho - Avatar ' + data.avatarName,
      'Relatorio de Sessao com Avatar',
      data.userName,
      data.sessionDate
    )

    const { report } = data
    const overall = report.overallScore ?? 0
    const sc = scoreColor(overall)

    doc.fontSize(36).font('Helvetica-Bold').fillColor(sc)
      .text(String(overall), PAGE_MARGIN, doc.y, { continued: true })
    doc.fontSize(14).font('Helvetica').fillColor(GRAY).text('/100  Pontuacao Global - ' + data.avatarName, { continued: false })
    doc.moveDown(0.6)

    if (report.summary) {
      doc.fontSize(11).font('Helvetica').fillColor(DARK)
        .text(report.summary, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 3 })
      doc.moveDown(1)
    }

    type AvDimKey = 'abordagemSocratica' | 'escutaAtiva' | 'respeitoSimbologiaPessoal' | 'evitouInterpretacaoDirecta' | 'criouEspacoSeguro' | 'progressoComAvatar'
    const DIMENSOES_AVATAR: Array<{ key: AvDimKey; label: string }> = [
      { key: 'abordagemSocratica', label: 'Abordagem Socratica' },
      { key: 'escutaAtiva', label: 'Escuta Activa' },
      { key: 'respeitoSimbologiaPessoal', label: 'Respeito pela Simbologia Pessoal' },
      { key: 'evitouInterpretacaoDirecta', label: 'Evitou Interpretacao Directa' },
      { key: 'criouEspacoSeguro', label: 'Criou Espaco Seguro' },
      { key: 'progressoComAvatar', label: 'Progresso com o Avatar' },
    ]

    doc.fontSize(11).font('Helvetica-Bold').fillColor(PURPLE).text('Dimensoes Avaliadas')
    doc.moveDown(0.4)

    for (const { key, label } of DIMENSOES_AVATAR) {
      const dim = report[key]
      if (!dim) continue
      if (doc.y > doc.page.height - 120) doc.addPage()

      const s = Math.min(100, Math.max(0, dim.score ?? 0))
      const c = scoreColor(s)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(label, PAGE_MARGIN, doc.y, { continued: true })
      doc.fillColor(c).text('  ' + s + '/100', { continued: false })
      const barY = doc.y + 2
      const barWidth = doc.page.width - PAGE_MARGIN * 2
      doc.rect(PAGE_MARGIN, barY, barWidth, 5).fill('#E5E7EB')
      doc.rect(PAGE_MARGIN, barY, barWidth * (s / 100), 5).fill(c)
      doc.moveDown(0.6)
      if (dim.feedback) {
        doc.fontSize(9).font('Helvetica').fillColor(GRAY)
          .text(dim.feedback, PAGE_MARGIN + 8, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 - 8, lineGap: 2 })
      }
      doc.moveDown(0.8)
    }

    if (report.techniquesDetected?.length) {
      if (doc.y > doc.page.height - 100) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(PURPLE).text('Tecnicas Detectadas')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica').fillColor(DARK)
        .text(report.techniquesDetected.join(', '), PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 })
      doc.moveDown(0.8)
    }

    if (report.strengths?.length) {
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(GREEN).text('Pontos Fortes')
      doc.moveDown(0.3)
      for (const item of report.strengths) {
        doc.fontSize(10).font('Helvetica').fillColor(DARK).text('v  ' + item, PAGE_MARGIN, doc.y, { lineGap: 2 })
        doc.moveDown(0.3)
      }
      doc.moveDown(0.5)
    }

    if (report.improvements?.length) {
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(YELLOW).text('Areas a Melhorar')
      doc.moveDown(0.3)
      for (const item of report.improvements) {
        doc.fontSize(10).font('Helvetica').fillColor(DARK).text('->  ' + item, PAGE_MARGIN, doc.y, { lineGap: 2 })
        doc.moveDown(0.3)
      }
      doc.moveDown(0.5)
    }

    if (report.criticalErrors?.length) {
      if (doc.y > doc.page.height - 100) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(RED).text('Erros Criticos')
      doc.moveDown(0.3)
      for (const item of report.criticalErrors) {
        doc.fontSize(10).font('Helvetica').fillColor(RED).text('!  ' + item, PAGE_MARGIN, doc.y, { lineGap: 2 })
        doc.moveDown(0.3)
      }
      doc.moveDown(0.5)
    }

    if (report.nextSteps) {
      if (doc.y > doc.page.height - 100) doc.addPage()
      doc.rect(PAGE_MARGIN, doc.y, doc.page.width - PAGE_MARGIN * 2, 4).fill(PURPLE_LIGHT)
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica-Bold').fillColor(PURPLE).text('Proximos Passos')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica').fillColor(DARK)
        .text(report.nextSteps, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 3 })
    }

    if (data.transcript?.length) {
      doc.addPage()
      doc.fontSize(14).font('Helvetica-Bold').fillColor(PURPLE).text('Transcricao da Sessao', PAGE_MARGIN, PAGE_MARGIN + 20)
      doc.moveDown(0.5)
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).strokeColor(PURPLE_LIGHT).stroke()
      doc.moveDown(0.8)

      for (const line of data.transcript) {
        if (doc.y > doc.page.height - 100) doc.addPage()
        const isTerapeuta = line.startsWith('[Terapeuta]')
        const roleLabel = isTerapeuta ? 'Terapeuta' : 'Avatar'
        const roleColor = isTerapeuta ? PURPLE : GRAY
        const content = line.replace(/^\[[^\]]+\]:\s*/, '')
        doc.fontSize(9).font('Helvetica-Bold').fillColor(roleColor).text(roleLabel)
        doc.moveDown(0.2)
        doc.fontSize(10).font('Helvetica').fillColor(DARK)
          .text(content, PAGE_MARGIN + 12, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 - 12, lineGap: 2 })
        doc.moveDown(0.7)
      }
    }

    addFooter(doc)
    doc.end()
  })
}
