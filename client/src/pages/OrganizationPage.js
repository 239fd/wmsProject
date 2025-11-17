import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
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
  Tabs,
  Tab,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Warehouse as WarehouseIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import RackDialog from '../components/shared/RackDialog';

const mockOrganization = {
  org_id: '1',
  name: 'ООО "Торговая компания"',
  short_name: 'ТК',
  unp: '123456789',
  address: 'г. Минск, ул. Примерная, 1',
  status: 'ACTIVE',
};

const mockWarehouses = [
  {
    warehouse_id: '1',
    name: 'Склад 1',
    address: 'ул. Складская, 10',
    responsible_user_id: '3',
    responsible_name: 'Сидорова А.С.',
    is_active: true,
    racks: [
      {
        rack_id: '1',
        name: 'Стеллаж А-1',
        kind: 'SHELF',
        shelf_count: 5,
        shelf_capacity_kg: 500,
        length_cm: 200,
        width_cm: 60,
        height_cm: 250,
        is_active: true,
      },
      {
        rack_id: '2',
        name: 'Холодильник Х-1',
        kind: 'FRIDGE',
        temperature_c: -18,
        length_cm: 300,
        width_cm: 150,
        height_cm: 220,
        is_active: true,
      },
    ],
  },
  {
    warehouse_id: '2',
    name: 'Склад 2',
    address: 'ул. Промышленная, 5',
    responsible_user_id: null,
    responsible_name: null,
    is_active: true,
    racks: [
      {
        rack_id: '3',
        name: 'Паллетный П-1',
        kind: 'PALLET',
        pallet_place_count: 24,
        max_weight_kg: 1000,
        length_cm: 400,
        width_cm: 200,
        height_cm: 300,
        is_active: true,
      },
    ],
  },
];

const rackTypeLabels = {
  SHELF: 'Полочный',
  CELL: 'Ячеистый',
  FRIDGE: 'Холодильник',
  PALLET: 'Паллетный',
};

const OrganizationPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [organization, setOrganization] = useState(mockOrganization);
  const [hasOrganization, setHasOrganization] = useState(true);
  const [warehouses, setWarehouses] = useState(mockWarehouses);

  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [orgDeleteDialogOpen, setOrgDeleteDialogOpen] = useState(false);
  const [orgForm, setOrgForm] = useState(organization);

  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [warehouseDeleteDialogOpen, setWarehouseDeleteDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', address: '' });

  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [rackDeleteDialogOpen, setRackDeleteDialogOpen] = useState(false);
  const [selectedRack, setSelectedRack] = useState(null);
  const [currentWarehouseId, setCurrentWarehouseId] = useState(null);

  const handleOrgDialogOpen = () => {
    setOrgForm(organization);
    setOrgDialogOpen(true);
  };

  const handleOrgSave = () => {
    if (!hasOrganization) {
      setHasOrganization(true);
      setOrganization({ ...orgForm, org_id: Date.now().toString(), status: 'ACTIVE' });
    } else {
      setOrganization(orgForm);
    }
    setOrgDialogOpen(false);
  };

  const handleOrgDelete = () => {
    setHasOrganization(false);
    setOrganization(null);
    setWarehouses([]);
    setOrgDeleteDialogOpen(false);
  };

  const handleWarehouseDialogOpen = (warehouse = null) => {
    if (warehouse) {
      setSelectedWarehouse(warehouse);
      setWarehouseForm({ name: warehouse.name, address: warehouse.address });
    } else {
      setSelectedWarehouse(null);
      setWarehouseForm({ name: '', address: '' });
    }
    setWarehouseDialogOpen(true);
  };

  const handleWarehouseSave = () => {
    if (selectedWarehouse) {
      setWarehouses(
        warehouses.map((wh) =>
          wh.warehouse_id === selectedWarehouse.warehouse_id
            ? { ...wh, ...warehouseForm }
            : wh
        )
      );
    } else {
      setWarehouses([
        ...warehouses,
        {
          warehouse_id: Date.now().toString(),
          ...warehouseForm,
          responsible_user_id: null,
          responsible_name: null,
          is_active: true,
          racks: [],
        },
      ]);
    }
    setWarehouseDialogOpen(false);
  };

  const handleWarehouseDelete = () => {
    setWarehouses(warehouses.filter((wh) => wh.warehouse_id !== selectedWarehouse.warehouse_id));
    setWarehouseDeleteDialogOpen(false);
    setSelectedWarehouse(null);
  };

  const handleRackDialogOpen = (warehouseId, rack = null) => {
    setCurrentWarehouseId(warehouseId);
    setSelectedRack(rack);
    setRackDialogOpen(true);
  };

  const handleRackSave = (rackData) => {
    setWarehouses(
      warehouses.map((wh) => {
        if (wh.warehouse_id === currentWarehouseId) {
          if (selectedRack) {
            return {
              ...wh,
              racks: wh.racks.map((r) =>
                r.rack_id === selectedRack.rack_id ? { ...r, ...rackData } : r
              ),
            };
          } else {
            return {
              ...wh,
              racks: [
                ...wh.racks,
                { ...rackData, rack_id: Date.now().toString(), is_active: true },
              ],
            };
          }
        }
        return wh;
      })
    );
  };

  const handleRackDelete = () => {
    setWarehouses(
      warehouses.map((wh) => {
        if (wh.warehouse_id === currentWarehouseId) {
          return {
            ...wh,
            racks: wh.racks.filter((r) => r.rack_id !== selectedRack.rack_id),
          };
        }
        return wh;
      })
    );
    setRackDeleteDialogOpen(false);
    setSelectedRack(null);
  };

  return (
    <Box sx={{ width: '100%', bgcolor: '#f5f5f5', minHeight: '100vh', pt: 4, pb: 6 }}>
      <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 } }}>
        <Typography variant="h4" fontWeight={700} mb={3}>
          Организация
        </Typography>

        <Paper sx={{ borderRadius: 3 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab icon={<BusinessIcon />} iconPosition="start" label="Реквизиты организации" />
            <Tab icon={<WarehouseIcon />} iconPosition="start" label="Склады" />
          </Tabs>

          {/* Вкладка: Организация */}
          {tabValue === 0 && (
            <Box sx={{ p: 4 }}>
              {!hasOrganization ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="h6" color="text.secondary" mb={3}>
                    У вас еще нет организации
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setOrgForm({ name: '', short_name: '', unp: '', address: '' });
                      setOrgDialogOpen(true);
                    }}
                  >
                    Создать организацию
                  </Button>
                </Box>
              ) : (
                <>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Полное наименование
                      </Typography>
                      <Typography variant="body1" mb={2}>
                        {organization.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Краткое наименование
                      </Typography>
                      <Typography variant="body1" mb={2}>
                        {organization.short_name || '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        УНП
                      </Typography>
                      <Typography variant="body1" mb={2}>
                        {organization.unp}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Статус
                      </Typography>
                      <Chip
                        label={organization.status === 'ACTIVE' ? 'Активна' : 'Неактивна'}
                        color={organization.status === 'ACTIVE' ? 'success' : 'default'}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Адрес
                      </Typography>
                      <Typography variant="body1" mb={2}>
                        {organization.address}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" startIcon={<EditIcon />} onClick={handleOrgDialogOpen}>
                      Редактировать
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setOrgDeleteDialogOpen(true)}
                    >
                      Удалить организацию
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* Вкладка: Склады */}
          {tabValue === 1 && (
            <Box sx={{ p: 4 }}>
              {!hasOrganization ? (
                <Alert severity="warning">
                  Сначала создайте организацию на вкладке "Реквизиты организации"
                </Alert>
              ) : (
                <>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleWarehouseDialogOpen()}
                    sx={{ mb: 3 }}
                  >
                    Добавить склад
                  </Button>

                  {warehouses.length === 0 ? (
                    <Typography color="text.secondary" align="center" py={4}>
                      Складов пока нет
                    </Typography>
                  ) : (
                    <Grid container spacing={3}>
                      {warehouses.map((warehouse) => (
                        <Grid item xs={12} key={warehouse.warehouse_id}>
                          <Card variant="outlined">
                            <CardContent>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                <Box>
                                  <Typography variant="h6" fontWeight={600}>
                                    {warehouse.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {warehouse.address}
                                  </Typography>
                                  {warehouse.responsible_name && (
                                    <Chip
                                      label={`Ответственный: ${warehouse.responsible_name}`}
                                      size="small"
                                      color="primary"
                                      sx={{ mt: 1 }}
                                    />
                                  )}
                                </Box>
                                <Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleWarehouseDialogOpen(warehouse)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setSelectedWarehouse(warehouse);
                                      setWarehouseDeleteDialogOpen(true);
                                    }}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Box>
                              </Box>

                              <Divider sx={{ my: 2 }} />

                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                  Топология склада (стеллажи)
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleRackDialogOpen(warehouse.warehouse_id)}
                                >
                                  Добавить стеллаж
                                </Button>
                              </Box>

                              {warehouse.racks.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  Стеллажей нет
                                </Typography>
                              ) : (
                                <TableContainer>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Название</TableCell>
                                        <TableCell>Тип</TableCell>
                                        <TableCell>Размеры (Д×Ш×В, см)</TableCell>
                                        <TableCell>Параметры</TableCell>
                                        <TableCell align="right">Действия</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {warehouse.racks.map((rack) => (
                                        <TableRow key={rack.rack_id}>
                                          <TableCell>{rack.name}</TableCell>
                                          <TableCell>
                                            <Chip
                                              label={rackTypeLabels[rack.kind]}
                                              size="small"
                                              color="primary"
                                              variant="outlined"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            {rack.length_cm}×{rack.width_cm}×{rack.height_cm}
                                          </TableCell>
                                          <TableCell>
                                            {rack.kind === 'SHELF' && (
                                              <>
                                                {rack.shelf_count && `${rack.shelf_count} полок, `}
                                                {rack.shelf_capacity_kg} кг/полка
                                              </>
                                            )}
                                            {rack.kind === 'CELL' && (
                                              <>
                                                {rack.cell_count && `${rack.cell_count} ячеек, `}
                                                {rack.max_weight_kg ? `${rack.max_weight_kg} кг/ячейка` : '—'}
                                              </>
                                            )}
                                            {rack.kind === 'FRIDGE' && `${rack.temperature_c}°C`}
                                            {rack.kind === 'PALLET' &&
                                              `${rack.pallet_place_count} мест, ${rack.max_weight_kg} кг`}
                                          </TableCell>
                                          <TableCell align="right">
                                            <IconButton
                                              size="small"
                                              onClick={() => handleRackDialogOpen(warehouse.warehouse_id, rack)}
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => {
                                                setCurrentWarehouseId(warehouse.warehouse_id);
                                                setSelectedRack(rack);
                                                setRackDeleteDialogOpen(true);
                                              }}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </>
              )}
            </Box>
          )}
        </Paper>

        {/* Диалог создания/редактирования организации */}
        <Dialog open={orgDialogOpen} onClose={() => setOrgDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {hasOrganization ? 'Редактировать организацию' : 'Создать организацию'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Полное наименование"
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Краткое наименование"
                value={orgForm.short_name}
                onChange={(e) => setOrgForm({ ...orgForm, short_name: e.target.value })}
                fullWidth
              />
              <TextField
                label="УНП"
                value={orgForm.unp}
                onChange={(e) => setOrgForm({ ...orgForm, unp: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Адрес"
                value={orgForm.address}
                onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOrgDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleOrgSave} variant="contained">
              {hasOrganization ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог удаления организации */}
        <ConfirmDialog
          open={orgDeleteDialogOpen}
          onClose={() => setOrgDeleteDialogOpen(false)}
          onConfirm={handleOrgDelete}
          title="Удаление организации"
          message="Вы уверены, что хотите удалить организацию? Все данные, включая склады и стеллажи, будут удалены."
        />

        {/* Диалог создания/редактирования склада */}
        <Dialog open={warehouseDialogOpen} onClose={() => setWarehouseDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>
            {selectedWarehouse ? 'Редактировать склад' : 'Добавить склад'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Наименование"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Адрес"
                value={warehouseForm.address}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWarehouseDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleWarehouseSave} variant="contained">
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог удаления склада */}
        <ConfirmDialog
          open={warehouseDeleteDialogOpen}
          onClose={() => setWarehouseDeleteDialogOpen(false)}
          onConfirm={handleWarehouseDelete}
          title="Удаление склада"
          message={`Вы уверены, что хотите удалить склад "${selectedWarehouse?.name}"?`}
        />

        {/* Диалог создания/редактирования стеллажа */}
        <RackDialog
          open={rackDialogOpen}
          onClose={() => setRackDialogOpen(false)}
          onSave={handleRackSave}
          initialData={selectedRack}
        />

        {/* Диалог удаления стеллажа */}
        <ConfirmDialog
          open={rackDeleteDialogOpen}
          onClose={() => setRackDeleteDialogOpen(false)}
          onConfirm={handleRackDelete}
          title="Удаление стеллажа"
          message={`Вы уверены, что хотите удалить стеллаж "${selectedRack?.name}"?`}
        />
      </Box>
    </Box>
  );
};

export default OrganizationPage;
