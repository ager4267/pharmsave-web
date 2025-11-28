'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { analyzeInventory } from '@/lib/utils/inventory-analyzer'
import type { ExpiringItem, DeadStockItem, InventoryAnalysisStatistics, AnalysisPeriod } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export default function InventoryAnalysisPage() {
  const [inventoryFile, setInventoryFile] = useState<File | null>(null)
  const [salesFile, setSalesFile] = useState<File | null>(null)
  const [period, setPeriod] = useState<AnalysisPeriod>('3months')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([])
  const [deadStockItems, setDeadStockItems] = useState<DeadStockItem[]>([])
  const [statistics, setStatistics] = useState<InventoryAnalysisStatistics | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleAnalyze = async () => {
    if (!inventoryFile || !salesFile) {
      setError('재고 파일과 매출 파일을 모두 업로드해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 재고 파일 파싱
      const inventoryBuffer = await inventoryFile.arrayBuffer()
      const inventoryWorkbook = XLSX.read(inventoryBuffer, { type: 'array' })
      const inventorySheet = inventoryWorkbook.Sheets[inventoryWorkbook.SheetNames[0]]
      const inventoryData = XLSX.utils.sheet_to_json(inventorySheet) as any[]

      const inventoryItems = inventoryData.map((row) => {
        // 제품명: 제품명, 상품명, 제품, 상품, product_name
        const productName = row['제품명'] || row['상품명'] || row['제품'] || row['상품'] || row['product_name'] || ''
        
        // 규격: 규격, 포장단위, 포장수량, specification
        const specification = row['규격'] || row['포장단위'] || row['포장수량'] || row['specification'] || ''
        
        // 제조번호: 제조번호, LOT, LOT번호, lot, lot번호, manufacturing_number (선택사항)
        const manufacturingNumber = row['제조번호'] || row['LOT'] || row['LOT번호'] || row['lot'] || row['lot번호'] || row['manufacturing_number'] || ''
        
        // 유효기간: 유효기간, 유통기한, 사용기한, expiry_date (선택사항)
        // Excel 날짜 숫자 형식도 그대로 전달 (analyzer에서 처리)
        let expiryDate = row['유효기간'] || row['유통기한'] || row['사용기한'] || row['expiry_date'] || ''
        
        // 문자열인 경우만 정리 (숫자는 Excel 날짜일 수 있으므로 그대로 전달)
        if (typeof expiryDate === 'string' && expiryDate.trim() !== '') {
          // 공백 제거
          expiryDate = expiryDate.trim()
        }
        
        // 수량: 수량, 갯수, 수, quantity
        const quantityStr = row['수량'] || row['갯수'] || row['수'] || row['quantity'] || '0'
        const quantity = parseInt(quantityStr, 10)
        
        return {
          product_name: productName,
          specification: specification,
          manufacturing_number: manufacturingNumber,
          expiry_date: expiryDate,
          quantity: quantity,
        }
      }).filter(item => item.product_name && item.quantity > 0) // 제품명과 수량만 필수

      // 매출 파일 파싱
      const salesBuffer = await salesFile.arrayBuffer()
      const salesWorkbook = XLSX.read(salesBuffer, { type: 'array' })
      const salesSheet = salesWorkbook.Sheets[salesWorkbook.SheetNames[0]]
      const salesData = XLSX.utils.sheet_to_json(salesSheet) as any[]

      const salesItems = salesData.map((row) => {
        // 매출일: 매출일, 출하일, 매출일자, 출하일자, sales_date
        const salesDate = row['매출일'] || row['출하일'] || row['매출일자'] || row['출하일자'] || row['sales_date'] || ''
        
        // 상품명: 상품명, 제품명, 제품, 상품, product_name
        const productName = row['상품명'] || row['제품명'] || row['제품'] || row['상품'] || row['product_name'] || ''
        
        // 규격: 규격, 포장단위, 포장수량, specification
        const specification = row['규격'] || row['포장단위'] || row['포장수량'] || row['specification'] || ''
        
        // 수량: 수량, 갯수, 수, quantity
        const quantityStr = row['수량'] || row['갯수'] || row['수'] || row['quantity'] || '0'
        const quantity = parseInt(quantityStr, 10)
        
        return {
          sales_date: salesDate,
          product_name: productName,
          specification: specification,
          quantity: quantity,
        }
      }).filter(item => item.product_name && item.sales_date)

      if (inventoryItems.length === 0) {
        setError('재고 파일에서 유효한 데이터를 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      // 디버깅: 유효기간이 있는 재고 수 확인
      const itemsWithExpiry = inventoryItems.filter(item => {
        if (!item.expiry_date) return false
        if (typeof item.expiry_date === 'string') {
          return item.expiry_date.trim() !== ''
        }
        return true // 숫자나 다른 타입도 유효기간으로 간주
      })
      console.log('📊 재고 분석 시작')
      console.log(`- 총 재고 수: ${inventoryItems.length}`)
      console.log(`- 유효기간이 있는 재고 수: ${itemsWithExpiry.length}`)
      if (itemsWithExpiry.length > 0) {
        console.log(`- 유효기간 샘플:`, itemsWithExpiry.slice(0, 3).map(item => ({
          제품명: item.product_name,
          유효기간: item.expiry_date,
          유효기간타입: typeof item.expiry_date
        })))
      }

      // 분석 실행
      const result = analyzeInventory(inventoryItems, salesItems, period)
      
      console.log('📊 분석 결과')
      console.log(`- 유효기간 임박 재고: ${result.expiringItems.length}개`)
      console.log(`- 불용 재고: ${result.deadStockItems.length}개`)

      setExpiringItems(result.expiringItems)
      setDeadStockItems(result.deadStockItems)
      setStatistics(result.statistics)

      // 데이터베이스에 저장
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('inventory_analyses').insert({
          user_id: user.id,
          analysis_period: period,
          expiring_items: result.expiringItems,
          dead_stock_items: result.deadStockItems,
          statistics: result.statistics,
        })

        // 관리자에게 이메일 전송
        try {
          await fetch('/api/email/inventory-analysis-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              period,
              statistics: result.statistics,
              expiringCount: result.expiringItems.length,
              deadStockCount: result.deadStockItems.length,
            }),
          })
        } catch (emailError) {
          console.error('이메일 전송 실패:', emailError)
        }
      }
    } catch (err: any) {
      const errorMessage = err?.message || '알 수 없는 오류가 발생했습니다.'
      console.error('❌ 재고 분석 오류:', err)
      console.error('오류 상세:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name
      })
      setError(`분석 중 오류가 발생했습니다: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!statistics) return

    const wb = XLSX.utils.book_new()

    // 유효기간 임박 재고 시트
    const expiringWS = XLSX.utils.json_to_sheet(
      expiringItems.map((item) => ({
        제품명: item.product_name,
        규격: item.specification,
        제조번호: item.manufacturing_number,
        유효기간: item.expiry_date,
        남은기간: `${item.days_remaining}일`,
        수량: item.quantity,
        위험도: item.risk_level,
      }))
    )
    XLSX.utils.book_append_sheet(wb, expiringWS, '유효기간 임박 재고')

    // 불용 재고 시트
    const deadStockWS = XLSX.utils.json_to_sheet(
      deadStockItems.map((item) => ({
        제품명: item.product_name,
        규격: item.specification,
        수량: item.quantity,
        마지막매출일: item.last_sales_date || '-',
        미매출기간: `${item.no_sales_period}일`,
        상태: item.dead_stock_status === 'dead_stock' ? '불용 재고' : '일반 재고',
      }))
    )
    XLSX.utils.book_append_sheet(wb, deadStockWS, '불용 재고')

    // 통계 시트
    const statsWS = XLSX.utils.json_to_sheet([
      { 항목: '총 재고 수', 값: statistics.total_items },
      { 항목: '유효기간 임박 재고 수', 값: statistics.expiring_count },
      { 항목: '유효기간 임박 재고 비율', 값: `${statistics.expiring_percentage.toFixed(2)}%` },
      { 항목: '불용 재고 수', 값: statistics.dead_stock_count },
      { 항목: '불용 재고 비율', 값: `${statistics.dead_stock_percentage.toFixed(2)}%` },
      { 항목: '위험도 높음', 값: statistics.risk_level_high },
      { 항목: '위험도 중간', 값: statistics.risk_level_medium },
      { 항목: '위험도 낮음', 값: statistics.risk_level_low },
    ])
    XLSX.utils.book_append_sheet(wb, statsWS, '통계')

    XLSX.writeFile(wb, `재고분석_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const chartData = statistics
    ? [
        { name: '일반 재고', value: statistics.total_items - statistics.expiring_count - statistics.dead_stock_count },
        { name: '유효기간 임박', value: statistics.expiring_count },
        { name: '불용 재고', value: statistics.dead_stock_count },
      ]
    : []

  const riskLevelData = statistics
    ? [
        { name: '높음', value: statistics.risk_level_high },
        { name: '중간', value: statistics.risk_level_medium },
        { name: '낮음', value: statistics.risk_level_low },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">재고 분석</h1>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">파일 업로드</h2>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  재고 파일 (제품명, 규격, 제조번호, 유효기간, 수량)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setInventoryFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  매출 파일 (최근 1년, 매출일, 상품명, 규격, 수량)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setSalesFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  분석 기간
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as AnalysisPeriod)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="3months">3개월</option>
                  <option value="6months">6개월</option>
                </select>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading || !inventoryFile || !salesFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '분석 중...' : '분석 실행'}
              </button>
            </div>
          </div>

          {statistics && (
            <>
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">통계</h2>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Excel 다운로드
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">총 재고 수</p>
                    <p className="text-2xl font-bold text-blue-600">{statistics.total_items}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">유효기간 임박</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {statistics.expiring_count} ({statistics.expiring_percentage.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">불용 재고</p>
                    <p className="text-2xl font-bold text-red-600">
                      {statistics.dead_stock_count} ({statistics.dead_stock_percentage.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">일반 재고</p>
                    <p className="text-2xl font-bold text-green-600">
                      {statistics.total_items - statistics.expiring_count - statistics.dead_stock_count}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-semibold mb-4">재고 분포</h3>
                    <PieChart width={300} height={300}>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </div>

                  <div>
                    <h3 className="text-md font-semibold mb-4">위험도 분포</h3>
                    <BarChart width={300} height={300} data={riskLevelData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </div>
                </div>
              </div>

              {expiringItems.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">
                    유효기간 임박 재고 ({expiringItems.length}개)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품명</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">규격</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유효기간</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">남은 기간</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">위험도</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {expiringItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.product_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.specification}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.expiry_date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.days_remaining}일
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                item.risk_level === 'high'
                                  ? 'bg-red-100 text-red-800'
                                  : item.risk_level === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {item.risk_level === 'high' && '높음'}
                                {item.risk_level === 'medium' && '중간'}
                                {item.risk_level === 'low' && '낮음'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {deadStockItems.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    불용 재고 ({deadStockItems.length}개)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품명</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">규격</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마지막 매출일</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">미매출 기간</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {deadStockItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.product_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.specification}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.last_sales_date || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.no_sales_period}일
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

