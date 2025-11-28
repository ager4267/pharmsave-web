import { readFile } from 'fs/promises'
import { join } from 'path'

export default async function EmailPolicyPage() {
  let content = ''
  
  try {
    const filePath = join(process.cwd(), '이메일주소무단수집금지 및 사징 금지 고지.txt')
    content = await readFile(filePath, 'utf-8')
  } catch (error) {
    content = '이메일주소무단수집금지 및 사칭 금지 고지 내용을 불러올 수 없습니다.'
  }

  // 텍스트를 HTML로 변환
  const htmlContent = content
    .split('\n')
    .map((line) => {
      // 제목 처리
      if (line.startsWith('**') && line.endsWith('**')) {
        return `<h1 class="text-2xl font-bold mb-4">${line.replace(/\*\*/g, '')}</h1>`
      }
      // 볼드 텍스트
      if (line.includes('**')) {
        return `<p class="mb-2">${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`
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

