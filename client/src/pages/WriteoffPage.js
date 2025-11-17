import React, { useState } from 'react';
import { Box, Typography, Paper, Button, TextField, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, MenuItem, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const reasons = [
    'Физический износ',
    'Моральный износ',
    'Порча',
    'Истёк срок годности',
    'Брак',
    'Утеря',
    'Хищение',
    'Стихийное бедствие',
    'Выявлено при инвентаризации',
    'Недостача сверх норм естественной убыли',
];

const units = ['шт', 'кг', 'л', 'м', 'м²', 'м³', 'упак'];

const initialItem = { name: '', invNumber: '', unit: 'шт', quantity: '', price: '', reason: '', notes: '' };

const WriteoffPage = () => {
    const [writeoffs, setWriteoffs] = useState([
        { id: 1, actNumber: 'СП-001', date: '2025-10-10', status: 'Утверждено', responsible: 'Иванов И.И.', sum: '15000.00' },
        { id: 2, actNumber: 'СП-002', date: '2025-10-16', status: 'Утверждено', responsible: 'Петров П.П.', sum: '8500.00' },
    ]);
    const [form, setForm] = useState({
        actNumber: '',
        date: '',
        responsible: '',
        commission: '',
        basis: '',
        items: [ { ...initialItem } ]
    });
    const [errors, setErrors] = useState({});

    const handleFormChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleItemChange = (idx, e) => {
        const items = form.items.map((p, i) => i === idx ? { ...p, [e.target.name]: e.target.value } : p);
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
        if (!form.responsible) newErrors.responsible = 'Укажите ответственного';
        if (!form.commission) newErrors.commission = 'Укажите состав комиссии';
        if (!form.basis) newErrors.basis = 'Укажите основание для списания';
        form.items.forEach((p, i) => {
            if (!p.name) newErrors[`item_name_${i}`] = 'Название обязательно';
            if (!p.invNumber) newErrors[`item_invNumber_${i}`] = 'Инв. номер обязателен';
            if (!p.quantity) newErrors[`item_quantity_${i}`] = 'Количество обязательно';
            if (!p.price) newErrors[`item_price_${i}`] = 'Балансовая стоимость обязательна';
            if (!p.reason) newErrors[`item_reason_${i}`] = 'Причина обязательна';
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        const totalSum = calculateTotalSum();
        setWriteoffs([
            ...writeoffs,
            {
                id: writeoffs.length + 1,
                actNumber: form.actNumber,
                date: form.date,
                responsible: form.responsible,
                status: 'Утверждено',
                sum: totalSum.toFixed(2),
            },
        ]);
        setForm({
            actNumber: '',
            date: '',
            responsible: '',
            commission: '',
            basis: '',
            items: [ { ...initialItem } ]
        });
        setErrors({});
    };

    const calculateTotalSum = () => {
        return form.items.reduce((sum, item) => {
            if (item.quantity && item.price) {
                return sum + (Number(item.quantity) * Number(item.price));
            }
            return sum;
        }, 0);
    };

    return (
        <Box sx={{ width: '100%', bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
            <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
                <Typography variant="h4" fontWeight={900} mb={3} textAlign="center">
                    Списание материальных ценностей
                </Typography>

                <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4 }}>
                    <Typography variant="h6" fontWeight={700} mb={2}>
                        Новый акт списания
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Оформление акта списания в соответствии с законодательством РБ
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
                                    placeholder="СП-001"
                                    error={!!errors.actNumber}
                                    helperText={errors.actNumber}
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
                                />
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
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Основание для списания"
                                    name="basis"
                                    value={form.basis}
                                    onChange={handleFormChange}
                                    fullWidth
                                    placeholder="Приказ №123 от 01.10.2025"
                                    error={!!errors.basis}
                                    helperText={errors.basis}
                                />
                            </Grid>
                        </Grid>

                        <Box mt={3}>
                            <Typography fontWeight={700} mb={1}>Позиции к списанию</Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ minWidth: 200 }}>Наименование</TableCell>
                                            <TableCell sx={{ minWidth: 120 }}>Инв. номер</TableCell>
                                            <TableCell sx={{ minWidth: 80 }}>Ед. изм.</TableCell>
                                            <TableCell sx={{ minWidth: 100 }}>Количество</TableCell>
                                            <TableCell sx={{ minWidth: 120 }}>Цена (руб.)</TableCell>
                                            <TableCell sx={{ minWidth: 120 }}>Сумма (руб.)</TableCell>
                                            <TableCell sx={{ minWidth: 150 }}>Причина</TableCell>
                                            <TableCell sx={{ minWidth: 200 }}>Примечание</TableCell>
                                            <TableCell sx={{ width: 50 }}></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {form.items.map((p, idx) => {
                                            const itemSum = p.quantity && p.price ? (Number(p.quantity) * Number(p.price)).toFixed(2) : '';
                                            return (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <TextField
                                                            name="name"
                                                            value={p.name}
                                                            onChange={e => handleItemChange(idx, e)}
                                                            size="small"
                                                            fullWidth
                                                            error={!!errors[`item_name_${idx}`]}
                                                            helperText={errors[`item_name_${idx}`]}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            name="invNumber"
                                                            value={p.invNumber}
                                                            onChange={e => handleItemChange(idx, e)}
                                                            size="small"
                                                            fullWidth
                                                            error={!!errors[`item_invNumber_${idx}`]}
                                                            helperText={errors[`item_invNumber_${idx}`]}
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
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            name="price"
                                                            value={p.price}
                                                            onChange={e => handleItemChange(idx, e)}
                                                            size="small"
                                                            type="number"
                                                            fullWidth
                                                            inputProps={{ step: "0.01", min: "0" }}
                                                            error={!!errors[`item_price_${idx}`]}
                                                            helperText={errors[`item_price_${idx}`]}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            value={itemSum}
                                                            size="small"
                                                            disabled
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            select
                                                            name="reason"
                                                            value={p.reason}
                                                            onChange={e => handleItemChange(idx, e)}
                                                            size="small"
                                                            fullWidth
                                                            error={!!errors[`item_reason_${idx}`]}
                                                            helperText={errors[`item_reason_${idx}`]}
                                                        >
                                                            <MenuItem value="">Выберите...</MenuItem>
                                                            {reasons.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                                                        </TextField>
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            name="notes"
                                                            value={p.notes}
                                                            onChange={e => handleItemChange(idx, e)}
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Дополнительная информация"
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
                                    <Typography variant="body1" fontWeight={700}>
                                        Итого к списанию: {calculateTotalSum().toFixed(2)} руб.
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Box mt={3} textAlign="right">
                            <Button type="submit" variant="contained" color="primary" size="large">
                                Сохранить акт списания
                            </Button>
                        </Box>
                    </form>
                </Paper>

                <Paper sx={{ p: { xs: 2, md: 4 } }}>
                    <Typography variant="h6" fontWeight={700} mb={2}>
                        История актов списания
                    </Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Номер акта</TableCell>
                                    <TableCell>Дата</TableCell>
                                    <TableCell>Ответственный</TableCell>
                                    <TableCell>Сумма (руб.)</TableCell>
                                    <TableCell>Статус</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {writeoffs.map(s => (
                                    <TableRow key={s.id} hover sx={{ cursor: 'pointer' }}>
                                        <TableCell fontWeight={600}>{s.actNumber}</TableCell>
                                        <TableCell>{s.date}</TableCell>
                                        <TableCell>{s.responsible}</TableCell>
                                        <TableCell>{s.sum}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={s.status}
                                                size="small"
                                                color={s.status === 'Утверждено' ? 'success' : 'warning'}
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

export default WriteoffPage;
