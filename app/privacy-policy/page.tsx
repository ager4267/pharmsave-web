import { readFile } from 'fs/promises'
import { join } from 'path'

export default async function PrivacyPolicyPage() {
  let content = ''
  
  try {
    const filePath = join(process.cwd(), '개인정보처리방침.txt')
    content = await readFile(filePath, 'utf-8')
  } catch (error) {
    content = '개인정보처리방침 내용을 불러올 수 없습니다.'
  }

  // 마크다운 형식을 HTML로 변환
  const lines = content.split('\n')
  let htmlContent = ''
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // 제목 처리
    if (trimmed.startsWith('# ')) {
      if (inList) {
        htmlContent += '</ul>'
        inList = false
      }
      htmlContent += `<h1 class="text-2xl font-bold mb-4">${trimmed.substring(2)}</h1>`
    } else if (trimmed.startsWith('## ')) {
      if (inList) {
        htmlContent += '</ul>'
        inList = false
      }
      htmlContent += `<h2 class="text-xl font-semibold mt-6 mb-3">${trimmed.substring(3)}</h2>`
    } else if (trimmed.startsWith('### ')) {
      if (inList) {
        htmlContent += '</ul>'
        inList = false
      }
      htmlContent += `<h3 class="text-lg font-medium mt-4 mb-2">${trimmed.substring(4)}</h3>`
    } else if (trimmed === '---') {
      // 구분선
      if (inList) {
        htmlContent += '</ul>'
        inList = false
      }
      htmlContent += '<hr class="my-4 border-gray-300" />'
    } else if (trimmed.startsWith('* ')) {
      // 리스트 항목
      if (!inList) {
        htmlContent += '<ul class="list-disc ml-6 mb-2 space-y-1">'
        inList = true
      }
      // 볼드 텍스트 처리 (**텍스트**)
      const listContent = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      htmlContent += `<li class="mb-1">${listContent}</li>`
    } else if (trimmed === '') {
      // 빈 줄
      if (inList) {
        htmlContent += '</ul>'
        inList = false
      }
      htmlContent += '<br />'
    } else {
      // 일반 텍스트
      if (inList) {
        htmlContent += '</ul>'
        inList = false
      }
      // 볼드 텍스트 처리 (**텍스트**)
      const textContent = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 링크 처리 ([텍스트](URL))
      const linkContent = textContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      htmlContent += `<p class="mb-2">${linkContent}</p>`
    }
  }
  
  // 리스트가 끝나지 않은 경우 닫기
  if (inList) {
    htmlContent += '</ul>'
  }

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

