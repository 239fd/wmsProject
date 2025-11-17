import React, { useState } from 'react';
import { Box, Typography, Paper, Button, TextField, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, MenuItem, Chip, Autocomplete } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const reasons = [
  'Изменение рыночной стоимости',
  'Решение об уценке',
  'Решение о дооценке',
  'Переоценка в связи с износом',
  'Модернизация',
  'Изменение курса валют',
  'Инфляция',
  'Изменение нормативных требований',
];

const units = ['шт', 'кг', 'л', 'м', 'м²', 'м³', 'упак'];

const mockProducts = [
  { label: 'Молоко пастеризованное 3,2%', sku: 'MILK-001' },
  { label: 'Хлеб белый формовой', sku: 'BREAD-001' },
  { label: 'Масло сливочное 82,5%', sku: 'BUTTER-001' },
  { label: 'Сыр твердый Гауда', sku: 'CHEESE-001' },
];

const initialItem = { name: '', unit: 'шт', quantity: '', oldPrice: '', newPrice: '', diff: '', diffPercent: '' };

const RevaluationPage = () => {
  const [revaluations, setRevaluations] = useState([
    { id: 1, actNumber: 'ПО-001', date: '2025-10-10', status: 'Утверждена', responsible: 'Иванов И.И.', diffSum: '+25000.00', reason: 'Изменение рыночной стоимости' },
    { id: 2, actNumber: 'ПО-002', date: '2025-10-16', status: 'Утверждена', responsible: 'Петров П.П.', diffSum: '-12000.00', reason: 'Решение об уценке' },
  ]);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    actNumber: '',
    date: today,
    reason: '',
    responsible: '',
    commission: '',
    basis: '',
    items: [ { ...initialItem } ]
  });
  const [errors, setErrors] = useState({});

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleItemChange = (idx, e, fieldName = null, fieldValue = null) => {
    const items = form.items.map((p, i) => {
      if (i === idx) {
        const updated = { ...p };
        if (fieldName && fieldValue !== null) {
          updated[fieldName] = fieldValue;
        } else {
          updated[e.target.name] = e.target.value;
        }
        const changedField = fieldName || e.target.name;
        if (changedField === 'oldPrice' || changedField === 'newPrice' || changedField === 'quantity') {
          const oldPrice = changedField === 'oldPrice' ? (fieldValue || e.target.value) : p.oldPrice;
          const newPrice = changedField === 'newPrice' ? (fieldValue || e.target.value) : p.newPrice;
          const quantity = changedField === 'quantity' ? (fieldValue || e.target.value) : p.quantity;
          if (oldPrice && newPrice && quantity) {
            const oldTotal = Number(oldPrice) * Number(quantity);
            const newTotal = Number(newPrice) * Number(quantity);
            updated.diff = (newTotal - oldTotal).toFixed(2);
            if (oldTotal !== 0) {
              updated.diffPercent = (((newTotal - oldTotal) / oldTotal) * 100).toFixed(2);
            }
          }
        }
        return updated;
      }
      return p;
    });
    setForm({ ...form, items });
  };

  const handleAddItem = () => {
    setForm({ ...form, items: [ ...form.items, { ...initialItem } ] });
  };

  const handleRemoveItem = (idx) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.actNumber) newErrors.actNumber = 'Укажите номер акта';
    if (!form.date) newErrors.date = 'Укажите дату';
    if (!form.reason) newErrors.reason = 'Укажите причину переоценки';
    if (!form.responsible) newErrors.responsible = 'Укажите ответственного';
    if (!form.commission) newErrors.commission = 'Укажите состав комиссии';
    if (!form.basis) newErrors.basis = 'Укажите основание для переоценки';
    form.items.forEach((p, i) => {
      if (!p.name) newErrors[`item_name_${i}`] = 'Название обязательно';
      if (!p.quantity) newErrors[`item_quantity_${i}`] = 'Количество обязательно';
      if (!p.oldPrice) newErrors[`item_oldPrice_${i}`] = 'Старая цена обязательна';
      if (!p.newPrice) newErrors[`item_newPrice_${i}`] = 'Новая цена обязательна';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const totalDiff = calculateTotalDiff();
    setRevaluations([
      ...revaluations,
      {
        id: revaluations.length + 1,
        actNumber: form.actNumber,
        date: form.date,
        reason: form.reason,
        responsible: form.responsible,
        status: 'Утверждена',
        diffSum: (totalDiff >= 0 ? '+' : '') + totalDiff.toFixed(2),
      },
    ]);
    setForm({
      actNumber: '',
      date: today,
      reason: '',
      responsible: '',
      commission: '',
      basis: '',
      items: [ { ...initialItem } ]
    });
    setErrors({});
  };

  const calculateTotalDiff = () => {
    return form.items.reduce((sum, item) => {
      if (item.diff) {
        return sum + Number(item.diff);
      }
      return sum;
    }, 0);
  };

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
        <Typography variant="h4" fontWeight={900} mb={3} textAlign="center">
          Переоценка материальных ценностей
        </Typography>

        <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4 }}>
          <Typography variant="h6" fontWeight={700} mb={2}>
            Новый акт переоценки
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Оформление акта переоценки в соответствии с законодательством РБ
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Номер акта"
                  name="actNumber"
                  value={form.actNumber}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="ПО-001"
                  error={!!errors.actNumber}
                  helperText={errors.actNumber}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Дата"
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleFormChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  error={!!errors.date}
                  helperText={errors.date}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Причина переоценки"
                  name="reason"
                  value={form.reason}
                  onChange={handleFormChange}
                  fullWidth
                  error={!!errors.reason}
                  helperText={errors.reason}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="">Выберите...</MenuItem>
                  {reasons.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Материально ответственное лицо"
                  name="responsible"
                  value={form.responsible}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="Иванов И.И."
                  error={!!errors.responsible}
                  helperText={errors.responsible}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Состав комиссии"
                  name="commission"
                  value={form.commission}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="Петров П.П., Сидоров С.С."
                  error={!!errors.commission}
                  helperText={errors.commission}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Основание для переоценки"
                  name="basis"
                  value={form.basis}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="Решение комиссии №45 от 15.10.2025, заключение оценщика"
                  error={!!errors.basis}
                  helperText={errors.basis}
                  sx={{ minWidth: 200 }}
                />
              </Grid>
            </Grid>

            <Box mt={3}>
              <Typography fontWeight={700} mb={1}>Позиции к переоценке</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 200 }}>Наименование</TableCell>
                      <TableCell sx={{ minWidth: 80 }}>Ед. изм.</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>Количество</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Старая цена (руб.)</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Новая цена (руб.)</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Изменение (руб.)</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>Изменение (%)</TableCell>
                      <TableCell sx={{ width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {form.items.map((p, idx) => {
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Autocomplete
                              freeSolo
                              options={mockProducts}
                              value={p.name}
                              onChange={(event, newValue) => {
                                handleItemChange(idx, null, 'name', typeof newValue === 'string' ? newValue : newValue?.label || '');
                              }}
                              onInputChange={(event, newInputValue) => {
                                handleItemChange(idx, null, 'name', newInputValue);
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  fullWidth
                                  error={!!errors[`item_name_${idx}`]}
                                  helperText={errors[`item_name_${idx}`]}
                                  sx={{ minWidth: 200 }}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              name="unit"
                              value={p.unit}
                              onChange={e => handleItemChange(idx, e)}
                              size="small"
                              fullWidth
                              sx={{ minWidth: 200 }}
                            >
                              {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField
                              name="quantity"
                              value={p.quantity}
                              onChange={e => handleItemChange(idx, e)}
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ step: "0.01", min: "0" }}
                              error={!!errors[`item_quantity_${idx}`]}
                              helperText={errors[`item_quantity_${idx}`]}
                              sx={{ minWidth: 200 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              name="oldPrice"
                              value={p.oldPrice}
                              onChange={e => handleItemChange(idx, e)}
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ step: "0.01", min: "0" }}
                              error={!!errors[`item_oldPrice_${idx}`]}
                              helperText={errors[`item_oldPrice_${idx}`]}
                              sx={{ minWidth: 200 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              name="newPrice"
                              value={p.newPrice}
                              onChange={e => handleItemChange(idx, e)}
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ step: "0.01", min: "0" }}
                              error={!!errors[`item_newPrice_${idx}`]}
                              helperText={errors[`item_newPrice_${idx}`]}
                              sx={{ minWidth: 200 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={p.diff || ''}
                              size="small"
                              disabled
                              fullWidth
                              sx={{
                                minWidth: 200,
                                '& .MuiInputBase-input': {
                                  color: p.diff ? (Number(p.diff) < 0 ? 'error.main' : Number(p.diff) > 0 ? 'success.main' : 'text.primary') : 'text.primary',
                                  fontWeight: 600
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={p.diffPercent ? p.diffPercent + '%' : ''}
                              size="small"
                              disabled
                              fullWidth
                              sx={{
                                minWidth: 200,
                                '& .MuiInputBase-input': {
                                  color: p.diffPercent ? (Number(p.diffPercent) < 0 ? 'error.main' : Number(p.diffPercent) > 0 ? 'success.main' : 'text.primary') : 'text.primary'
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => handleRemoveItem(idx)}
                              disabled={form.items.length === 1}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Button startIcon={<AddIcon />} onClick={handleAddItem}>
                  Добавить позицию
                </Button>
                <Box>
                  <Typography
                    variant="body1"
                    fontWeight={700}
                    color={calculateTotalDiff() < 0 ? 'error.main' : calculateTotalDiff() > 0 ? 'success.main' : 'text.primary'}
                  >
                    Итоговое изменение стоимости: {calculateTotalDiff() >= 0 ? '+' : ''}{calculateTotalDiff().toFixed(2)} руб.
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box mt={3} textAlign="right">
              <Button type="submit" variant="contained" color="primary" size="large">
                Сохранить акт переоценки
              </Button>
            </Box>
          </form>
        </Paper>

        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Typography variant="h6" fontWeight={700} mb={2}>
            История актов переоценки
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Номер акта</TableCell>
                  <TableCell>Дата</TableCell>
                  <TableCell>Причина</TableCell>
                  <TableCell>Ответственный</TableCell>
                  <TableCell>Изменение (руб.)</TableCell>
                  <TableCell>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {revaluations.map(s => (
                  <TableRow key={s.id} hover sx={{ cursor: 'pointer' }}>
                    <TableCell fontWeight={600}>{s.actNumber}</TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>{s.reason}</TableCell>
                    <TableCell>{s.responsible}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={s.diffSum.startsWith('-') ? 'error.main' : 'success.main'}
                      >
                        {s.diffSum}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={s.status}
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
      </Box>
    </Box>
  );
};

export default RevaluationPage;
