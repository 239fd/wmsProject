import React, { useState } from 'react';
import { Box, Typography, Paper, Button, TextField, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, MenuItem, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Autocomplete } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';

const initialItem = {
  sku: '',
  productName: '',
  batchNumber: '',
  unit: 'шт',
  countedQuantity: '',
};

const reasons = [
  'Плановая инвентаризация',
  'Смена материально ответственного лица',
  'Перед составлением годовой отчетности',
  'При установлении фактов хищения',
  'После стихийных бедствий',
];

const units = ['шт', 'кг', 'л', 'м', 'м²', 'м³', 'упак'];

const warehouses = ['Склад №1', 'Склад №2', 'Холодильная камера'];

const mockProducts = [
  { label: 'Молоко пастеризованное 3,2%', sku: 'MILK-001' },
  { label: 'Хлеб белый формовой', sku: 'BREAD-001' },
  { label: 'Масло сливочное 82,5%', sku: 'BUTTER-001' },
  { label: 'Сыр твердый Гауда', sku: 'CHEESE-001' },
];

const mockBatches = [
  { label: 'Партия №12345', batchNumber: 'BTH-12345' },
  { label: 'Партия №12346', batchNumber: 'BTH-12346' },
  { label: 'Партия №12347', batchNumber: 'BTH-12347' },
];

const InventoryPage = () => {
  const [sessions, setSessions] = useState([
    {
      id: 1,
      sessionNumber: 'ИНВ-001',
      startedAt: '2025-01-10 09:00',
      endedAt: '2025-01-10 15:30',
      status: 'COMPLETED',
      startedBy: 'Иванов И.И.',
      warehouse: 'Склад №1',
      itemsCount: 45,
      discrepancies: 3
    },
    {
      id: 2,
      sessionNumber: 'ИНВ-002',
      startedAt: '2025-01-15 10:00',
      endedAt: '2025-01-15 17:00',
      status: 'COMPLETED',
      startedBy: 'Петров П.П.',
      warehouse: 'Склад №2',
      itemsCount: 32,
      discrepancies: 1
    },
  ]);

  const [activeSession, setActiveSession] = useState(null);

  const [sessionItems, setSessionItems] = useState([]);

  const [openStartDialog, setOpenStartDialog] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({
    warehouse: '',
    startedBy: '',
    reason: '',
    commission: '',
  });
  const [sessionErrors, setSessionErrors] = useState({});

  const [itemForm, setItemForm] = useState({ ...initialItem });
  const [itemErrors, setItemErrors] = useState({});

  const handleStartSession = () => {
    const errors = {};
    if (!newSessionForm.warehouse) errors.warehouse = 'Укажите склад';
    if (!newSessionForm.startedBy) errors.startedBy = 'Укажите ответственного';
    if (!newSessionForm.reason) errors.reason = 'Укажите причину';
    if (!newSessionForm.commission) errors.commission = 'Укажите комиссию';

    if (Object.keys(errors).length > 0) {
      setSessionErrors(errors);
      return;
    }

    const newSession = {
      id: Date.now(),
      sessionNumber: 'ИНВ-' + String(sessions.length + 1).padStart(3, '0'),
      warehouse: newSessionForm.warehouse,
      startedBy: newSessionForm.startedBy,
      reason: newSessionForm.reason,
      commission: newSessionForm.commission,
      startedAt: new Date().toLocaleString('ru-RU'),
      status: 'IN_PROGRESS',
    };

    setActiveSession(newSession);
    setSessionItems([]);
    setOpenStartDialog(false);
    setNewSessionForm({
      warehouse: '',
      startedBy: '',
      reason: '',
      commission: '',
    });
    setSessionErrors({});
  };

  const handleAddItem = () => {
    const errors = {};
    if (!itemForm.productName) errors.productName = 'Укажите наименование';
    if (!itemForm.countedQuantity) errors.countedQuantity = 'Укажите фактическое количество';

    if (Object.keys(errors).length > 0) {
      setItemErrors(errors);
      return;
    }

    const newItem = {
      id: Date.now(),
      ...itemForm,
      scannedAt: new Date().toLocaleString('ru-RU'),
      scannedBy: activeSession.startedBy,
      expectedQuantity: (Math.random() * 100).toFixed(2),
    };

    setSessionItems([...sessionItems, newItem]);
    setItemForm({ ...initialItem });
    setItemErrors({});
  };

  const handleRemoveItem = (itemId) => {
    setSessionItems(sessionItems.filter(item => item.id !== itemId));
  };

  const handleCompleteSession = () => {
    if (sessionItems.length === 0) {
      alert('Добавьте хотя бы один товар перед завершением сессии');
      return;
    }

    const completedSession = {
      ...activeSession,
      status: 'COMPLETED',
      endedAt: new Date().toLocaleString('ru-RU'),
      itemsCount: sessionItems.length,
      discrepancies: sessionItems.filter(item => {
        const diff = Number(item.countedQuantity) - (Number(item.expectedQuantity) || 0);
        return diff !== 0;
      }).length,
    };

    setSessions([completedSession, ...sessions]);
    setActiveSession(null);
    setSessionItems([]);
  };

  const handleCancelSession = () => {
    if (window.confirm('Вы уверены, что хотите отменить текущую сессию? Все добавленные товары будут удалены.')) {
      setActiveSession(null);
      setSessionItems([]);
    }
  };

  const calculateDiscrepancy = (item) => {
    if (!item.expectedQuantity || !item.countedQuantity) return null;
    return Number(item.countedQuantity) - Number(item.expectedQuantity);
  };

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
        <Typography variant="h4" fontWeight={900} mb={3} textAlign="center">
          Инвентаризация
        </Typography>

        {activeSession ? (
          <>
            <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4, bgcolor: 'success.50', border: 2, borderColor: 'success.main' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h5" fontWeight={700} color="success.dark">
                    Активная сессия: {activeSession.sessionNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    Начата: {activeSession.startedAt} | Склад: {activeSession.warehouse} | Ответственный: {activeSession.startedBy}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Причина: {activeSession.reason}
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<StopIcon />}
                    onClick={handleCompleteSession}
                  >
                    Завершить сессию
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleCancelSession}
                  >
                    Отменить
                  </Button>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                Товаров добавлено: <strong>{sessionItems.length}</strong>
              </Alert>

              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  Добавить товар в сессию
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Артикул (SKU)"
                      name="sku"
                      value={itemForm.sku}
                      onChange={(e) => {
                        const sku = e.target.value;
                        setItemForm({ ...itemForm, sku });
                        const foundProduct = mockProducts.find(p => p.sku === sku);
                        if (foundProduct) {
                          setItemForm({ ...itemForm, sku, productName: foundProduct.label });
                        }
                      }}
                      fullWidth
                      size="small"
                      placeholder="MILK-001"
                      error={!!itemErrors.sku}
                      helperText={itemErrors.sku || "Отсканируйте или введите артикул"}
                      sx={{ minWidth: 200 }}
                      autoFocus
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Autocomplete
                      freeSolo
                      options={mockProducts}
                      value={itemForm.productName}
                      onChange={(event, newValue) => {
                        const productName = typeof newValue === 'string' ? newValue : newValue?.label || '';
                        const sku = typeof newValue === 'object' && newValue?.sku ? newValue.sku : itemForm.sku;
                        setItemForm({ ...itemForm, productName, sku });
                      }}
                      onInputChange={(event, newInputValue) => {
                        setItemForm({ ...itemForm, productName: newInputValue });
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Наименование товара"
                          size="small"
                          error={!!itemErrors.productName}
                          helperText={itemErrors.productName}
                          sx={{ minWidth: 200 }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      freeSolo
                      options={mockBatches}
                      value={itemForm.batchNumber}
                      onChange={(event, newValue) => {
                        setItemForm({ ...itemForm, batchNumber: typeof newValue === 'string' ? newValue : newValue?.label || '' });
                      }}
                      onInputChange={(event, newInputValue) => {
                        setItemForm({ ...itemForm, batchNumber: newInputValue });
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Номер партии"
                          size="small"
                          sx={{ minWidth: 200 }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={1.5}>
                    <TextField
                      select
                      label="Ед. изм."
                      value={itemForm.unit}
                      onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                      fullWidth
                      size="small"
                      sx={{ minWidth: 200 }}
                    >
                      {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={1.5}>
                    <TextField
                      label="Фактически"
                      type="number"
                      value={itemForm.countedQuantity}
                      onChange={(e) => setItemForm({ ...itemForm, countedQuantity: e.target.value })}
                      fullWidth
                      size="small"
                      inputProps={{ step: "0.01" }}
                      error={!!itemErrors.countedQuantity}
                      helperText={itemErrors.countedQuantity}
                      sx={{ minWidth: 200 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={handleAddItem}
                      fullWidth
                      sx={{ height: '40px' }}
                    >
                      Добавить
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {sessionItems.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Артикул (SKU)</TableCell>
                        <TableCell>Наименование</TableCell>
                        <TableCell>Партия</TableCell>
                        <TableCell>Ед. изм.</TableCell>
                        <TableCell>По учету</TableCell>
                        <TableCell>Фактически</TableCell>
                        <TableCell>Разница</TableCell>
                        <TableCell>Время</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sessionItems.map((item) => {
                        const diff = calculateDiscrepancy(item);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{item.sku || '-'}</TableCell>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.batchNumber || '-'}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>{item.expectedQuantity || '-'}</TableCell>
                            <TableCell>{item.countedQuantity}</TableCell>
                            <TableCell>
                              {diff !== null && (
                                <Chip
                                  label={diff >= 0 ? `+${diff}` : diff}
                                  size="small"
                                  color={diff === 0 ? 'default' : diff > 0 ? 'success' : 'error'}
                                />
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{item.scannedAt}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </>
        ) : (
          <Box textAlign="center" mb={4}>
            <Paper sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
              <Typography variant="h6" mb={2}>
                Нет активной сессии инвентаризации
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Начните новую сессию для проведения инвентаризации товаров на складе
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={() => setOpenStartDialog(true)}
              >
                Начать новую сессию
              </Button>
            </Paper>
          </Box>
        )}

        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Typography variant="h6" fontWeight={700} mb={2}>
            История инвентаризаций
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Номер сессии</TableCell>
                  <TableCell>Склад</TableCell>
                  <TableCell>Начало</TableCell>
                  <TableCell>Окончание</TableCell>
                  <TableCell>Ответственный</TableCell>
                  <TableCell>Товаров</TableCell>
                  <TableCell>Расхождений</TableCell>
                  <TableCell>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map(s => (
                  <TableRow key={s.id} hover sx={{ cursor: 'pointer' }}>
                    <TableCell fontWeight={600}>{s.sessionNumber}</TableCell>
                    <TableCell>{s.warehouse}</TableCell>
                    <TableCell>{s.startedAt}</TableCell>
                    <TableCell>{s.endedAt}</TableCell>
                    <TableCell>{s.startedBy}</TableCell>
                    <TableCell>{s.itemsCount}</TableCell>
                    <TableCell>
                      <Chip
                        label={s.discrepancies}
                        size="small"
                        color={s.discrepancies === 0 ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={s.status === 'COMPLETED' ? 'Завершена' : 'В процессе'}
                        size="small"
                        color="success"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={openStartDialog} onClose={() => setOpenStartDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Начать новую сессию инвентаризации</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Склад"
                  value={newSessionForm.warehouse}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, warehouse: e.target.value })}
                  fullWidth
                  error={!!sessionErrors.warehouse}
                  helperText={sessionErrors.warehouse}
                  sx={{ minWidth: 200 }}
                >
                  {warehouses.map(w => <MenuItem key={w} value={w}>{w}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Материально ответственное лицо"
                  value={newSessionForm.startedBy}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, startedBy: e.target.value })}
                  fullWidth
                  placeholder="Иванов И.И."
                  error={!!sessionErrors.startedBy}
                  helperText={sessionErrors.startedBy}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Причина инвентаризации"
                  value={newSessionForm.reason}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, reason: e.target.value })}
                  fullWidth
                  error={!!sessionErrors.reason}
                  helperText={sessionErrors.reason}
                  sx={{ minWidth: 200 }}
                >
                  {reasons.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Состав комиссии"
                  value={newSessionForm.commission}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, commission: e.target.value })}
                  fullWidth
                  placeholder="Петров П.П., Сидоров С.С."
                  error={!!sessionErrors.commission}
                  helperText={sessionErrors.commission}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenStartDialog(false)}>Отмена</Button>
            <Button onClick={handleStartSession} variant="contained" color="primary">
              Начать сессию
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default InventoryPage;
