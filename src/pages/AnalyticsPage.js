import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Tabs,
  Tab,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  LocalShipping as ShippingIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Speed as SpeedIcon,
  Timer as TimerIcon
} from '@mui/icons-material';

const mockKpiData = [
  { label: 'Всего товаров', value: '2 847', icon: InventoryIcon, color: '#1976d2', trend: '+12%' },
  { label: 'Активных позиций', value: '1 245', icon: TrendingUpIcon, color: '#2e7d32', trend: '+8%' },
  { label: 'Операций за период', value: '3 654', icon: ShippingIcon, color: '#ed6c02', trend: '+15%' },
  { label: 'Свободных мест', value: '1 542', icon: InventoryIcon, color: '#9c27b0', trend: '-5%' },
];

const mockWarehouseTurnover = [
  { name: 'Склад 1', operations: 1245, utilization: 78, efficiency: 92 },
  { name: 'Склад 2', operations: 987, utilization: 65, efficiency: 88 },
  { name: 'Склад 3', operations: 1422, utilization: 85, efficiency: 95 },
];

const mockOperationsByType = [
  { type: 'Приемка', count: 1245, percentage: 34, color: '#2e7d32' },
  { type: 'Отгрузка', count: 1520, percentage: 42, color: '#1976d2' },
  { type: 'Переоценка', count: 456, percentage: 12, color: '#ed6c02' },
  { type: 'Списание', count: 433, percentage: 12, color: '#d32f2f' },
];

const mockWarehouseOperations = {
  week: [
    { warehouse: 'Склад 1', period1: 45, period2: 52, period3: 48, period4: 50, period5: 55, period6: 42, period7: 38 },
    { warehouse: 'Склад 2', period1: 38, period2: 42, period3: 40, period4: 45, period5: 48, period6: 35, period7: 30 },
    { warehouse: 'Склад 3', period1: 50, period2: 55, period3: 52, period4: 58, period5: 60, period6: 48, period7: 45 },
  ],
  month: [
    { warehouse: 'Склад 1', period1: 280, period2: 310, period3: 295, period4: 360 },
    { warehouse: 'Склад 2', period1: 220, period2: 245, period3: 230, period4: 292 },
    { warehouse: 'Склад 3', period1: 315, period2: 340, period3: 365, period4: 402 },
  ],
  quarter: [
    { warehouse: 'Склад 1', period1: 870, period2: 920, period3: 950 },
    { warehouse: 'Склад 2', period1: 687, period2: 710, period3: 745 },
    { warehouse: 'Склад 3', period1: 980, period2: 1020, period3: 1055 },
  ],
  year: [
    { warehouse: 'Склад 1', period1: 2740, period2: 2850, period3: 2920, period4: 3100 },
    { warehouse: 'Склад 2', period1: 2142, period2: 2230, period3: 2310, period4: 2450 },
    { warehouse: 'Склад 3', period1: 3055, period2: 3180, period3: 3290, period4: 3520 },
  ],
};

const periodLabels = {
  week: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  month: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
  quarter: ['Месяц 1', 'Месяц 2', 'Месяц 3'],
  year: ['Кв. 1', 'Кв. 2', 'Кв. 3', 'Кв. 4'],
};

const mockEmployeePerformance = [
  { name: 'Иванов И.', operations: 345, avgTime: 12, efficiency: 95 },
  { name: 'Петров П.', operations: 320, avgTime: 13, efficiency: 92 },
  { name: 'Сидорова А.', operations: 298, avgTime: 14, efficiency: 88 },
  { name: 'Козлов А.', operations: 285, avgTime: 15, efficiency: 85 },
];

const mockOrderFulfillment = {
  onTime: 92,
  delayed: 5,
  critical: 3,
  avgTime: 18.5,
  target: 24,
};

const mockDailyOperations = [
  { day: 'Пн', operations: 520 },
  { day: 'Вт', operations: 680 },
  { day: 'Ср', operations: 590 },
  { day: 'Чт', operations: 720 },
  { day: 'Пт', operations: 810 },
  { day: 'Сб', operations: 450 },
  { day: 'Вс', operations: 280 },
];

const periods = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

const AnalyticsPage = () => {
  const [period, setPeriod] = useState('month');
  const [tabValue, setTabValue] = useState(0);

  const renderKpiCards = () => (
    <Grid container spacing={3} mb={4}>
      {mockKpiData.map((kpi) => {
        const Icon = kpi.icon;
        const isPositive = kpi.trend.startsWith('+');
        return (
          <Grid item xs={12} sm={6} md={3} key={kpi.label}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box
                    sx={{
                      bgcolor: kpi.color + '20',
                      borderRadius: 2,
                      p: 1,
                      display: 'flex',
                    }}
                  >
                    <Icon sx={{ color: kpi.color, fontSize: 28 }} />
                  </Box>
                  <Chip
                    label={kpi.trend}
                    size="small"
                    color={isPositive ? 'success' : 'error'}
                    icon={isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  />
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  {kpi.value}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {kpi.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );

  const renderWarehousePerformance = () => (
    <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={3}>
        Эффективность складов
      </Typography>
      <Grid container spacing={3}>
        {mockWarehouseTurnover.map((warehouse) => (
          <Grid item xs={12} md={4} key={warehouse.name}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>
                  {warehouse.name}
                </Typography>
                <Box mb={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Операций: {warehouse.operations}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2">Заполненность</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {warehouse.utilization}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={warehouse.utilization}
                    sx={{ height: 8, borderRadius: 1, mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2">Эффективность</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {warehouse.efficiency}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={warehouse.efficiency}
                    color="success"
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );

  const renderOperationsByType = () => (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={3}>
        Операции по типам
      </Typography>
      <Box>
        {mockOperationsByType.map((op) => (
          <Box key={op.type} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">{op.type}</Typography>
              <Typography variant="body2" fontWeight={600}>
                {op.count} ({op.percentage}%)
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', height: 32, bgcolor: '#f5f5f5', borderRadius: 1, overflow: 'hidden' }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${op.percentage}%`,
                  bgcolor: op.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  px: 1,
                  transition: 'width 0.5s ease',
                }}
              >
                <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  {op.count}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );

  const renderDailyOperationsChart = () => (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={3}>
        Загруженность по дням недели
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {mockDailyOperations.map((item) => {
          const maxOps = Math.max(...mockDailyOperations.map((d) => d.operations));
          const percentage = (item.operations / maxOps) * 100;
          return (
            <Box key={item.day} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ minWidth: 40, fontSize: 14, fontWeight: 600 }}>
                {item.day}
              </Typography>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    bgcolor: '#1976d2',
                    height: 36,
                    borderRadius: 1,
                    width: `${percentage}%`,
                    minWidth: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    px: 2,
                    transition: 'width 0.5s ease',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                    {item.operations}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );

  const renderOrderFulfillment = () => (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={3}>
        Выполнение заказов
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
              <Typography variant="h4" fontWeight={700} color="#2e7d32">
                {mockOrderFulfillment.onTime}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Вовремя
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <TimerIcon sx={{ fontSize: 48, color: '#ed6c02', mb: 1 }} />
              <Typography variant="h4" fontWeight={700} color="#ed6c02">
                {mockOrderFulfillment.delayed}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Задержки
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon sx={{ fontSize: 48, color: '#d32f2f', mb: 1 }} />
              <Typography variant="h4" fontWeight={700} color="#d32f2f">
                {mockOrderFulfillment.critical}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Критические
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <SpeedIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
              <Typography variant="h4" fontWeight={700} color="#1976d2">
                {mockOrderFulfillment.avgTime}ч
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Среднее время
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Alert severity="success" sx={{ mt: 2 }}>
        Целевое время: {mockOrderFulfillment.target}ч | Текущий показатель лучше целевого на{' '}
        {((mockOrderFulfillment.target - mockOrderFulfillment.avgTime) / mockOrderFulfillment.target * 100).toFixed(1)}%
      </Alert>
    </Paper>
  );

  const renderWarehouseOperationsChart = () => {
    const data = mockWarehouseOperations[period];
    const labels = periodLabels[period];
    const periodCount = labels.length;

    return (
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={3}>
          Динамика операций по складам
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Склад</TableCell>
                {labels.map((label, idx) => (
                  <TableCell key={idx} align="center">
                    {label}
                  </TableCell>
                ))}
                <TableCell align="center">Итого</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((wh) => {
                const values = [];
                for (let i = 1; i <= periodCount; i++) {
                  values.push(wh[`period${i}`]);
                }
                const total = values.reduce((sum, val) => sum + val, 0);

                return (
                  <TableRow key={wh.warehouse}>
                    <TableCell>
                      <Typography fontWeight={600}>{wh.warehouse}</Typography>
                    </TableCell>
                    {values.map((val, idx) => (
                      <TableCell key={idx} align="center">
                        <Chip label={val} size="small" color="primary" variant="outlined" />
                      </TableCell>
                    ))}
                    <TableCell align="center">
                      <Chip label={total} size="small" color="success" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  const renderEmployeePerformance = () => (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={2}>
        Производительность сотрудников
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Сотрудник</TableCell>
              <TableCell align="right">Операций</TableCell>
              <TableCell align="right">Среднее время, мин</TableCell>
              <TableCell align="right">Эффективность</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockEmployeePerformance.map((emp) => (
              <TableRow key={emp.name}>
                <TableCell>{emp.name}</TableCell>
                <TableCell align="right">{emp.operations}</TableCell>
                <TableCell align="right">{emp.avgTime}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Box sx={{ width: 100, mr: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={emp.efficiency}
                        color={emp.efficiency >= 90 ? 'success' : 'warning'}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {emp.efficiency}%
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  return (
    <Box sx={{ width: '100%', pt: 4, pb: 6, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight={700}>
            Аналитика и отчетность
          </Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Период</InputLabel>
            <Select
              value={period}
              label="Период"
              variant="outlined"
              onChange={(e) => setPeriod(e.target.value)}
            >
              {periods.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* KPI карточки */}
        {renderKpiCards()}

        {/* Вкладки */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Paper sx={{ borderRadius: 3, display: 'inline-block' }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Обзор" />
              <Tab label="Операции" />
              <Tab label="Сотрудники" />
            </Tabs>
          </Paper>
        </Box>

        {/* Вкладка: Обзор */}
        {tabValue === 0 && (
          <Box>
            {renderWarehousePerformance()}
            <Grid container spacing={3} mb={3}>
              <Grid item xs={12} md={6}>
                {renderOperationsByType()}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderDailyOperationsChart()}
              </Grid>
            </Grid>
            {renderOrderFulfillment()}
          </Box>
        )}

        {/* Вкладка: Операции */}
        {tabValue === 1 && (
          <Box>
            {renderWarehouseOperationsChart()}
          </Box>
        )}

        {/* Вкладка: Сотрудники */}
        {tabValue === 2 && (
          <Box>
            {renderEmployeePerformance()}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AnalyticsPage;
