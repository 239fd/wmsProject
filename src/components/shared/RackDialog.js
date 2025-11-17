import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Divider
} from '@mui/material';

const rackTypes = [
  { value: 'SHELF', label: 'Стеллаж с полками' },
  { value: 'CELL', label: 'Ячеистый стеллаж' },
  { value: 'FRIDGE', label: 'Холодильник' },
  { value: 'PALLET', label: 'Паллетный стеллаж' },
];

const RackDialog = ({ open, onClose, onSave, initialData = null }) => {
  const [form, setForm] = useState(
    initialData || {
      name: '',
      kind: 'SHELF',
      // Для SHELF
      shelf_count: '',
      shelf_capacity_kg: '',
      // Для CELL
      cell_count: '',
      max_weight_kg: '',
      // Для FRIDGE
      temperature_c: '',
      // Для PALLET
      pallet_place_count: '',
      // Общие размеры (для одной полки/ячейки или всего стеллажа)
      length_cm: '',
      width_cm: '',
      height_cm: '',
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = () => {
    onSave(form);
    onClose();
  };

  const renderSpecificFields = () => {
    switch (form.kind) {
      case 'SHELF':
        return (
          <>
            <TextField
              label="Количество полок"
              name="shelf_count"
              type="number"
              value={form.shelf_count}
              onChange={handleChange}
              fullWidth
              required
              helperText="Сколько полок на стеллаже"
            />
            <TextField
              label="Грузоподъемность одной полки (кг)"
              name="shelf_capacity_kg"
              type="number"
              value={form.shelf_capacity_kg}
              onChange={handleChange}
              fullWidth
              required
            />
          </>
        );
      case 'CELL':
        return (
          <>
            <TextField
              label="Количество ячеек"
              name="cell_count"
              type="number"
              value={form.cell_count}
              onChange={handleChange}
              fullWidth
              required
              helperText="Сколько ячеек на стеллаже"
            />
            <TextField
              label="Максимальный вес одной ячейки (кг)"
              name="max_weight_kg"
              type="number"
              value={form.max_weight_kg}
              onChange={handleChange}
              fullWidth
            />
          </>
        );
      case 'FRIDGE':
        return (
          <TextField
            label="Температура (°C)"
            name="temperature_c"
            type="number"
            value={form.temperature_c}
            onChange={handleChange}
            fullWidth
          />
        );
      case 'PALLET':
        return (
          <>
            <TextField
              label="Количество паллетных мест"
              name="pallet_place_count"
              type="number"
              value={form.pallet_place_count}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              label="Максимальный вес (кг)"
              name="max_weight_kg"
              type="number"
              value={form.max_weight_kg}
              onChange={handleChange}
              fullWidth
              required
            />
          </>
        );
      default:
        return null;
    }
  };

  const getDimensionsHelperText = () => {
    switch (form.kind) {
      case 'SHELF':
        return 'Размеры одной полки';
      case 'CELL':
        return 'Размеры одной ячейки';
      case 'FRIDGE':
        return 'Размеры холодильника';
      case 'PALLET':
        return 'Размеры паллетного стеллажа';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialData ? 'Редактировать стеллаж' : 'Добавить стеллаж'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Наименование"
            name="name"
            value={form.name}
            onChange={handleChange}
            fullWidth
            required
          />
          <FormControl fullWidth>
            <InputLabel>Тип стеллажа</InputLabel>
            <Select
              name="kind"
              value={form.kind}
              label="Тип стеллажа"
              onChange={handleChange}
            >
              {rackTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            Специфические параметры
          </Typography>
          {renderSpecificFields()}

          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            {getDimensionsHelperText()}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
            <TextField
              label="Длина (см)"
              name="length_cm"
              type="number"
              value={form.length_cm}
              onChange={handleChange}
              required
            />
            <TextField
              label="Ширина (см)"
              name="width_cm"
              type="number"
              value={form.width_cm}
              onChange={handleChange}
              required
            />
            <TextField
              label="Высота (см)"
              name="height_cm"
              type="number"
              value={form.height_cm}
              onChange={handleChange}
              required
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSubmit} variant="contained">
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RackDialog;
