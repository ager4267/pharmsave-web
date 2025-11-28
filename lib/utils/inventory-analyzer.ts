import type { ExpiringItem, DeadStockItem, InventoryAnalysisStatistics, AnalysisPeriod } from '@/lib/types'

export interface InventoryItem {
  product_name: string
  specification: string
  manufacturing_number?: string
  expiry_date: string
  quantity: number
}

export interface SalesItem {
  sales_date: string
  product_name: string
  specification: string
  quantity: number
}

export interface AnalysisResult {
  expiringItems: ExpiringItem[]
  deadStockItems: DeadStockItem[]
  statistics: InventoryAnalysisStatistics
}

export function analyzeInventory(
  inventoryItems: InventoryItem[],
  salesItems: SalesItem[],
  period: AnalysisPeriod
): AnalysisResult {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const periodDays = period === '3months' ? 90 : 180
  const expiryThreshold = new Date(today)
  expiryThreshold.setDate(expiryThreshold.getDate() + periodDays)

  const salesPeriodDays = period === '3months' ? 90 : 180
  const salesCutoffDate = new Date(today)
  salesCutoffDate.setDate(salesCutoffDate.getDate() - salesPeriodDays)

  // 유효기간 임박 재고 분석
  const expiringItems: ExpiringItem[] = inventoryItems
    .filter((item) => {
      // 유효기간이 없으면 제외
      if (!item.expiry_date) return false
      
      // 문자열인 경우 빈 문자열 체크
      if (typeof item.expiry_date === 'string' && item.expiry_date.trim() === '') return false
      
      // 날짜 파싱 시도
      let expiryDate: Date
      
      // Excel 날짜 숫자 형식인 경우 (예: 44927 = 2023-01-01)
      if (typeof item.expiry_date === 'number') {
        const excelEpoch = new Date(1900, 0, 1)
        expiryDate = new Date(excelEpoch.getTime() + (item.expiry_date - 2) * 24 * 60 * 60 * 1000)
      } else {
        expiryDate = new Date(item.expiry_date)
      }
      
      // 유효하지 않은 날짜면 제외
      if (isNaN(expiryDate.getTime())) {
        console.warn('유효하지 않은 날짜 형식:', item.expiry_date, '제품명:', item.product_name)
        return false
      }
      
      expiryDate.setHours(0, 0, 0, 0)
      return expiryDate <= expiryThreshold && expiryDate > today
    })
    .map((item) => {
      // 날짜 파싱 (filter에서 이미 검증되었지만 다시 파싱)
      let expiryDate: Date
      if (typeof item.expiry_date === 'number') {
        const excelEpoch = new Date(1900, 0, 1)
        expiryDate = new Date(excelEpoch.getTime() + (item.expiry_date - 2) * 24 * 60 * 60 * 1000)
      } else {
        expiryDate = new Date(item.expiry_date!)
      }
      expiryDate.setHours(0, 0, 0, 0)
      const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      let riskLevel: 'high' | 'medium' | 'low'
      if (daysRemaining <= 30) {
        riskLevel = 'high'
      } else if (daysRemaining <= 60) {
        riskLevel = 'medium'
      } else {
        riskLevel = 'low'
      }

      // 날짜를 yyyy-mm-dd 형식 문자열로 변환
      const expiryDateStr = expiryDate.toISOString().split('T')[0]
      
      return {
        product_name: item.product_name,
        specification: item.specification,
        manufacturing_number: item.manufacturing_number || '',
        expiry_date: expiryDateStr, // 날짜 형식 문자열로 저장
        days_remaining: daysRemaining,
        quantity: item.quantity,
        risk_level: riskLevel,
        priority: daysRemaining <= 30 ? 1 : daysRemaining <= 60 ? 2 : 3,
      }
    })
    .sort((a, b) => a.days_remaining - b.days_remaining)

  // 불용 재고 분석
  const inventoryMap = new Map<string, InventoryItem>()
  inventoryItems.forEach((item) => {
    const key = `${item.product_name}_${item.specification}`
    if (!inventoryMap.has(key)) {
      inventoryMap.set(key, { ...item, quantity: 0 })
    }
    const existing = inventoryMap.get(key)!
    existing.quantity += item.quantity
  })

  const salesMap = new Map<string, SalesItem[]>()
  salesItems
    .filter((sale) => {
      const saleDate = new Date(sale.sales_date)
      return saleDate >= salesCutoffDate
    })
    .forEach((sale) => {
      const key = `${sale.product_name}_${sale.specification}`
      if (!salesMap.has(key)) {
        salesMap.set(key, [])
      }
      salesMap.get(key)!.push(sale)
    })

  const deadStockItems: DeadStockItem[] = Array.from(inventoryMap.entries())
    .filter(([key]) => {
      const sales = salesMap.get(key)
      return !sales || sales.length === 0
    })
    .map(([key, item]) => {
      // 가장 최근 매출일 찾기
      const allSales = salesItems.filter(
        (sale) => `${sale.product_name}_${sale.specification}` === key
      )
      let lastSalesDate: string | undefined
      let noSalesPeriod = salesPeriodDays

      if (allSales.length > 0) {
        const sortedSales = allSales.sort(
          (a, b) => new Date(b.sales_date).getTime() - new Date(a.sales_date).getTime()
        )
        lastSalesDate = sortedSales[0].sales_date
        const lastDate = new Date(lastSalesDate)
        noSalesPeriod = Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        product_name: item.product_name,
        specification: item.specification,
        quantity: item.quantity,
        last_sales_date: lastSalesDate,
        no_sales_period: noSalesPeriod,
        dead_stock_status: (noSalesPeriod >= salesPeriodDays ? 'dead_stock' : 'normal') as 'dead_stock' | 'normal',
        priority: noSalesPeriod >= salesPeriodDays * 2 ? 1 : noSalesPeriod >= salesPeriodDays ? 2 : 3,
      }
    })
    .filter((item) => item.dead_stock_status === 'dead_stock')
    .sort((a, b) => b.no_sales_period - a.no_sales_period)

  // 통계 계산
  const totalItems = inventoryItems.length
  const expiringCount = expiringItems.length
  const deadStockCount = deadStockItems.length

  const riskLevelHigh = expiringItems.filter((item) => item.risk_level === 'high').length
  const riskLevelMedium = expiringItems.filter((item) => item.risk_level === 'medium').length
  const riskLevelLow = expiringItems.filter((item) => item.risk_level === 'low').length

  const statistics: InventoryAnalysisStatistics = {
    total_items: totalItems,
    expiring_count: expiringCount,
    expiring_percentage: totalItems > 0 ? (expiringCount / totalItems) * 100 : 0,
    dead_stock_count: deadStockCount,
    dead_stock_percentage: totalItems > 0 ? (deadStockCount / totalItems) * 100 : 0,
    risk_level_high: riskLevelHigh,
    risk_level_medium: riskLevelMedium,
    risk_level_low: riskLevelLow,
  }

  return {
    expiringItems,
    deadStockItems,
    statistics,
  }
}

