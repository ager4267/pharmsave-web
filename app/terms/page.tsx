import { readFile } from 'fs/promises'
import { join } from 'path'

export default async function TermsPage() {
  let content = ''
  
  try {
    const filePath = join(process.cwd(), '총칙.txt')
    content = await readFile(filePath, 'utf-8')
  } catch (error) {
    content = '이용약관 내용을 불러올 수 없습니다.'
  }

  // 텍스트를 HTML로 변환
  const htmlContent = content
    .split('\n')
    .map((line) => {
      // 제목 처리 (제1조, 제2조 등)
      if (line.match(/^제\d+조/)) {
        return `<h2 class="text-xl font-semibold mt-6 mb-3">${line}</h2>`
      }
      // 번호 항목
      if (line.match(/^①|^②|^③|^④|^⑤|^⑥|^⑦/)) {
        return `<p class="ml-4 mb-2 font-medium">${line}</p>`
      }
      // 리스트 항목
      if (line.trim().startsWith('* ')) {
        return `<li class="ml-6 mb-1">${line.substring(2)}</li>`
      }
      // 빈 줄
      if (line.trim() === '') {
        return '<br />'
      }
      // 일반 텍스트
      return `<p class="mb-2">${line}</p>`
    })
    .join('')

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div 
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  )
}

