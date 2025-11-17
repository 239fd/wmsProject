import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Chip,
  InputAdornment,
  Tooltip,
  Alert
} from '@mui/material';
import {
  PersonOff as PersonOffIcon,
  Search as SearchIcon,
  ManageAccounts as ManageAccountsIcon
} from '@mui/icons-material';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const mockEmployees = [
  {
    user_id: '1',
    full_name: 'Иванов Иван Иванович',
    email: 'ivanov@mail.com',
    roles: ['WORKER'],
    warehouse_id: '1',
    warehouse_name: 'Склад 1',
    is_active: true,
    is_responsible: false,
  },
  {
    user_id: '2',
    full_name: 'Петров Петр Петрович',
    email: 'petrov@mail.com',
    roles: ['ACCOUNTANT'],
    warehouse_id: '2',
    warehouse_name: 'Склад 2',
    is_active: true,
    is_responsible: false,
  },
  {
    user_id: '3',
    full_name: 'Сидорова Анна Сергеевна',
    email: 'sidorova@mail.com',
    roles: ['WORKER'],
    warehouse_id: '1',
    warehouse_name: 'Склад 1',
    is_active: true,
    is_responsible: true,
  },
  {
    user_id: '4',
    full_name: 'Козлов Алексей Дмитриевич',
    email: 'kozlov@mail.com',
    roles: ['WORKER'],
    warehouse_id: '3',
    warehouse_name: 'Склад 3',
    is_active: true,
    is_responsible: false,
  },
  {
    user_id: '5',
    full_name: 'Новикова Мария Олеговна',
    email: 'novikova@mail.com',
    roles: ['ACCOUNTANT'],
    warehouse_id: null,
    warehouse_name: null,
    is_active: false,
    is_responsible: false,
  },
];

const mockWarehouses = [
  { warehouse_id: '1', name: 'Склад 1', address: 'ул. Складская, 10' },
  { warehouse_id: '2', name: 'Склад 2', address: 'ул. Промышленная, 5' },
  { warehouse_id: '3', name: 'Склад 3', address: 'ул. Логистическая, 15' },
];

const roleLabels = {
  WORKER: 'Работник',
  ACCOUNTANT: 'Бухгалтер',
  DIRECTOR: 'Директор',
};

const roleColors = {
  WORKER: 'primary',
  ACCOUNTANT: 'secondary',
  DIRECTOR: 'error',
};

const EmployeesPage = () => {
  const [employees, setEmployees] = useState(mockEmployees);
  const [warehouses] = useState(mockWarehouses);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter ? emp.roles.includes(roleFilter) : true;

    const matchesStatus =
      statusFilter === 'active'
        ? emp.is_active
        : statusFilter === 'dismissed'
        ? !emp.is_active
        : true;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleDismissOpen = (employee) => {
    setSelectedEmployee(employee);
    setDismissDialogOpen(true);
  };

  const handleDismissConfirm = () => {
    setEmployees(
      employees.map((emp) =>
        emp.user_id === selectedEmployee.user_id
          ? { ...emp, is_active: false, is_responsible: false }
          : emp
      )
    );
    setDismissDialogOpen(false);
    setSelectedEmployee(null);
  };

  const handleAssignOpen = (employee) => {
    setSelectedEmployee(employee);
    setSelectedWarehouse(employee.warehouse_id || '');
    setAssignDialogOpen(true);
  };

  const handleAssignConfirm = () => {
    if (!selectedWarehouse) return;

    if (selectedEmployee.warehouse_id && selectedEmployee.warehouse_id !== selectedWarehouse) {
      alert('Ошибка: Сотрудник не может быть ответственным за склад, на котором он не работает!');
      return;
    }

    setEmployees(
      employees.map((emp) => {
        if (emp.warehouse_id === selectedWarehouse && emp.is_responsible) {
          return { ...emp, is_responsible: false };
        }
        if (emp.user_id === selectedEmployee.user_id) {
          const warehouse = warehouses.find((w) => w.warehouse_id === selectedWarehouse);
          return {
            ...emp,
            warehouse_id: selectedWarehouse,
            warehouse_name: warehouse?.name,
            is_responsible: true,
          };
        }
        return emp;
      })
    );

    setAssignDialogOpen(false);
    setSelectedEmployee(null);
    setSelectedWarehouse('');
  };

  return (
    <Box sx={{ width: '100%', bgcolor: '#f5f5f5', minHeight: '100vh', pt: 4, pb: 6 }}>
      <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 } }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Сотрудники
        </Typography>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Поиск по имени или email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ minWidth: 280 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Фильтр по роли</InputLabel>
              <Select
                value={roleFilter}
                label="Фильтр по роли"
                onChange={(e) => setRoleFilter(e.target.value)}
                variant="outlined"
              >
                <MenuItem value="">Все роли</MenuItem>
                <MenuItem value="WORKER">Работник</MenuItem>
                <MenuItem value="ACCOUNTANT">Бухгалтер</MenuItem>
                <MenuItem value="DIRECTOR">Директор</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Статус</InputLabel>
              <Select
                value={statusFilter}
                label="Статус"
                onChange={(e) => setStatusFilter(e.target.value)}
                variant="outlined"
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="active">Активные</MenuItem>
                <MenuItem value="dismissed">Уволенные</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Склад</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" py={3}>
                      Сотрудники не найдены
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow key={emp.user_id} hover>
                    <TableCell>
                      <Typography variant="body2">{emp.full_name}</Typography>
                    </TableCell>
                    <TableCell>{emp.email}</TableCell>
                    <TableCell>
                      {emp.roles.map((role) => (
                        <Chip
                          key={role}
                          label={roleLabels[role]}
                          color={roleColors[role]}
                          size="small"
                          sx={{ mr: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      {emp.warehouse_name || '—'}
                      {emp.is_responsible && (
                        <Chip
                          label="Ответственный"
                          color="success"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={emp.is_active ? 'Активен' : 'Уволен'}
                        color={emp.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {emp.is_active && (
                        <>
                          <Tooltip title="Назначить ответственным за склад">
                            <IconButton
                              onClick={() => handleAssignOpen(emp)}
                              color="primary"
                              size="small"
                            >
                              <ManageAccountsIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Уволить сотрудника">
                            <IconButton
                              onClick={() => handleDismissOpen(emp)}
                              color="error"
                              size="small"
                            >
                              <PersonOffIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <ConfirmDialog
          open={dismissDialogOpen}
          onClose={() => setDismissDialogOpen(false)}
          onConfirm={handleDismissConfirm}
          title="Увольнение сотрудника"
          message={`Вы уверены, что хотите уволить ${selectedEmployee?.full_name}?`}
        />

        <Dialog
          open={assignDialogOpen}
          onClose={() => setAssignDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Назначить ответственным за склад</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" mb={2}>
                Сотрудник: <strong>{selectedEmployee?.full_name}</strong>
              </Typography>
              {selectedEmployee?.warehouse_id && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Текущий склад: {selectedEmployee.warehouse_name}
                </Alert>
              )}
              <FormControl fullWidth>
                <InputLabel>Выберите склад</InputLabel>
                <Select
                  value={selectedWarehouse}
                  label="Выберите склад"
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  variant="outlined"
                >
                  {warehouses.map((wh) => {
                    const isDisabled = selectedEmployee?.warehouse_id && selectedEmployee.warehouse_id !== wh.warehouse_id;
                    return (
                      <MenuItem
                        key={wh.warehouse_id}
                        value={wh.warehouse_id}
                        disabled={isDisabled}
                      >
                        {wh.name} ({wh.address})
                        {isDisabled && ' - недоступен'}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              {selectedEmployee?.warehouse_id && selectedEmployee.warehouse_id !== selectedWarehouse && selectedWarehouse && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Сотрудник не может быть назначен ответственным за склад, на котором он не работает.
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={handleAssignConfirm}
              variant="contained"
              disabled={!selectedWarehouse}
            >
              Назначить
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default EmployeesPage;
