import React, {useState} from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    TextField,
    Grid,
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
    Chip,
    Alert,
    Autocomplete,
    Divider,
    Card,
    CardContent,
    LinearProgress,
    Tabs,
    Tab,
    Badge,
    Stepper,
    Step,
    StepLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarningIcon from '@mui/icons-material/Warning';
import InventoryIcon from '@mui/icons-material/Inventory';

const mockProducts = [
    {product_id: '1', name: 'Молоко 3.2%', sku: 'MILK-001', barcode: '4607025392201', unit: 'л', category: 'Молочные продукты'},
    {product_id: '2', name: 'Хлеб белый', sku: 'BREAD-001', barcode: '4601546078902', unit: 'шт', category: 'Хлебобулочные'},
    {product_id: '3', name: 'Масло сливочное', sku: 'BUTTER-001', barcode: '4607025392301', unit: 'кг', category: 'Молочные продукты'},
    {product_id: '4', name: 'Яйца куриные', sku: 'EGGS-001', barcode: '4607012345678', unit: 'шт', category: 'Яйца'},
    {product_id: '5', name: 'Сахар', sku: 'SUGAR-001', barcode: '4607098765432', unit: 'кг', category: 'Бакалея'},
];

const mockStock = [
    {
        stock_id: '1',
        product_id: '1',
        batch_number: 'B-2025-001',
        quantity: 300,
        reserved: 50,
        warehouse_name: 'Холодильный склад',
        rack_name: 'Камера 1',
        place_name: 'Полка A1',
        production_date: '2025-01-10',
        expiry_date: '2025-02-10'
    },
    {
        stock_id: '2',
        product_id: '1',
        batch_number: 'B-2025-002',
        quantity: 200,
        reserved: 0,
        warehouse_name: 'Холодильный склад',
        rack_name: 'Камера 1',
        place_name: 'Полка A2',
        production_date: '2025-01-15',
        expiry_date: '2025-02-15'
    },
    {
        stock_id: '3',
        product_id: '2',
        batch_number: 'B-2025-100',
        quantity: 150,
        reserved: 20,
        warehouse_name: 'Основной склад',
        rack_name: 'Стеллаж A1',
        place_name: 'Полка 1',
        production_date: '2025-01-18',
        expiry_date: '2025-01-21'
    },
    {
        stock_id: '4',
        product_id: '2',
        batch_number: 'B-2025-101',
        quantity: 50,
        reserved: 0,
        warehouse_name: 'Основной склад',
        rack_name: 'Стеллаж A1',
        place_name: 'Полка 2',
        production_date: '2025-01-19',
        expiry_date: '2025-01-22'
    },
    {
        stock_id: '5',
        product_id: '3',
        batch_number: 'B-2025-050',
        quantity: 100,
        reserved: 10,
        warehouse_name: 'Холодильный склад',
        rack_name: 'Камера 2',
        place_name: 'Полка B1',
        production_date: '2025-01-12',
        expiry_date: '2025-03-12'
    },
    {
        stock_id: '6',
        product_id: '4',
        batch_number: 'B-2025-200',
        quantity: 500,
        reserved: 100,
        warehouse_name: 'Холодильный склад',
        rack_name: 'Камера 1',
        place_name: 'Полка C1',
        production_date: '2025-01-16',
        expiry_date: '2025-02-01'
    },
    {
        stock_id: '7',
        product_id: '5',
        batch_number: 'B-2025-300',
        quantity: 300,
        reserved: 0,
        warehouse_name: 'Основной склад',
        rack_name: 'Стеллаж B1',
        place_name: null,
        production_date: '2024-12-01',
        expiry_date: '2026-12-01'
    },
];

const steps = ['Создание заявки', 'Выбор товаров', 'Резервирование'];

const ShipPage = () => {
    const [shipments, setShipments] = useState([
        {
            shipment_id: '1',
            created_at: '2025-01-15T10:30:00',
            status: 'in_progress',
            customer_name: 'ООО "Рога и Копыта"',
            comment: 'Срочная отгрузка',
            items: [
                {
                    shipment_item_id: '1-1',
                    product_id: '1',
                    planned_quantity: 50,
                    actual_quantity: 30,
                    reservations: [
                        {stock_id: '1', reserved_qty: 50, picked_qty: 30}
                    ]
                },
                {
                    shipment_item_id: '1-2',
                    product_id: '2',
                    planned_quantity: 20,
                    actual_quantity: 20,
                    reservations: [
                        {stock_id: '3', reserved_qty: 20, picked_qty: 20}
                    ]
                }
            ]
        },
        {
            shipment_id: '2',
            created_at: '2025-01-16T14:20:00',
            status: 'completed',
            customer_name: 'ИП Петров',
            comment: '',
            items: [
                {
                    shipment_item_id: '2-1',
                    product_id: '3',
                    planned_quantity: 10,
                    actual_quantity: 10,
                    reservations: [{stock_id: '5', reserved_qty: 10, picked_qty: 10}]
                }
            ]
        },
        {
            shipment_id: '3',
            created_at: '2025-01-17T09:00:00',
            status: 'pending',
            customer_name: 'ООО "Продукты+"',
            comment: 'Клиент ждет до 12:00',
            items: [
                {
                    shipment_item_id: '3-1',
                    product_id: '4',
                    planned_quantity: 100,
                    actual_quantity: 0,
                    reservations: []
                },
                {
                    shipment_item_id: '3-2',
                    product_id: '5',
                    planned_quantity: 25,
                    actual_quantity: 0,
                    reservations: []
                }
            ]
        },
    ]);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [openDialog, setOpenDialog] = useState(false);
    const [viewDialog, setViewDialog] = useState(false);
    const [scanDialog, setScanDialog] = useState(false);
    const [selectedShipment, setSelectedShipment] = useState(null);

    const [tabValue, setTabValue] = useState(0);

    const [activeStep, setActiveStep] = useState(0);
    const [shipmentForm, setShipmentForm] = useState({
        customer_name: '',
        desired_date: new Date().toISOString().split('T')[0],
        comment: '',
        items: []
    });

    const [currentItem, setCurrentItem] = useState({
        product_id: '',
        planned_quantity: '',
        reservations: []
    });

    const [searchInput, setSearchInput] = useState('');

    const [availableStock, setAvailableStock] = useState([]);

    const [scanInput, setScanInput] = useState('');
    const [scanQuantity, setScanQuantity] = useState(1);

    const handleOpenDialog = () => {
        setOpenDialog(true);
        setActiveStep(0);
        setShipmentForm({
            customer_name: '',
            desired_date: new Date().toISOString().split('T')[0],
            comment: '',
            items: []
        });
        setCurrentItem({
            product_id: '',
            planned_quantity: '',
            reservations: []
        });
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setActiveStep(0);
        setAvailableStock([]);
    };

    const handleNext = () => {
        if (activeStep === 0) {
            if (!shipmentForm.customer_name) {
                setError('Введите получателя');
                return;
            }
            setActiveStep(1);
        } else if (activeStep === 1) {
            if (shipmentForm.items.length === 0) {
                setError('Добавьте хотя бы один товар');
                return;
            }
            setActiveStep(2);
        }
        setError('');
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleSearchProduct = () => {
        if (!searchInput.trim()) {
            setError('Введите название, SKU или штрихкод товара');
            return;
        }

        const product = mockProducts.find(p =>
            p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
            p.sku.toLowerCase() === searchInput.toLowerCase() ||
            p.barcode === searchInput.trim()
        );

        if (!product) {
            setError('Товар не найден');
            return;
        }

        const stocks = mockStock.filter(s => s.product_id === product.product_id);
        const stocksWithAvailable = stocks.map(s => ({
            ...s,
            available: s.quantity - s.reserved
        })).filter(s => s.available > 0);

        if (stocksWithAvailable.length === 0) {
            setError('Товар отсутствует на складе');
            return;
        }

        setCurrentItem({
            ...currentItem,
            product_id: product.product_id
        });
        setAvailableStock(stocksWithAvailable);
        setError('');
    };

    const handleAddItemToRequest = () => {
        if (!currentItem.product_id || !currentItem.planned_quantity) {
            setError('Укажите товар и количество');
            return;
        }
        if (parseFloat(currentItem.planned_quantity) <= 0) {
            setError('Количество должно быть больше 0');
            return;
        }
        const stocks = mockStock
            .filter(s => s.product_id === currentItem.product_id)
            .map(s => ({...s, available: s.quantity - s.reserved}))
            .filter(s => s.available > 0);
        const totalAvailable = stocks.reduce((sum, s) => sum + s.available, 0);
        if (totalAvailable === 0) {
            setError('Товар отсутствует на складе');
            return;
        }
        if (parseFloat(currentItem.planned_quantity) > totalAvailable) {
            setError(`Недостаточно товара. Доступно: ${totalAvailable}`);
            return;
        }
        setShipmentForm(prev => ({
            ...prev,
            items: [...prev.items, {
                product_id: currentItem.product_id,
                planned_quantity: currentItem.planned_quantity,
                reservations: []
            }]
        }));
        setCurrentItem({
            product_id: '',
            planned_quantity: '',
            reservations: []
        });
        setAvailableStock([]);
        setSearchInput('');
        setError('');
        setSuccess('Товар добавлен в заявку');
    };

    const handleRemoveItem = (index) => {
        setShipmentForm({
            ...shipmentForm,
            items: shipmentForm.items.filter((_, i) => i !== index)
        });
    };

    const handleAutoReserve = (itemIndex) => {
        const stocks = mockStock
            .filter(s => s.product_id === shipmentForm.items[itemIndex].product_id)
            .map(s => ({...s, available: s.quantity - s.reserved}))
            .filter(s => s.available > 0)
            .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

        let remaining = parseFloat(shipmentForm.items[itemIndex].planned_quantity);
        const reservations = [];

        for (const stock of stocks) {
            if (remaining <= 0) break;

            const toReserve = Math.min(remaining, stock.available);
            reservations.push({
                stock_id: stock.stock_id,
                reserved_qty: toReserve,
                picked_qty: 0
            });
            remaining -= toReserve;
        }

        if (remaining > 0) {
            setError('Недостаточно товара для резервирования');
            return;
        }

        const updatedItems = [...shipmentForm.items];
        updatedItems[itemIndex].reservations = reservations;
        setShipmentForm({...shipmentForm, items: updatedItems});
        setSuccess('Резервирование выполнено автоматически (FEFO)');
        setError('');
    };

    const handleManualReserve = (itemIndex, stockId, quantity) => {
        const stock = mockStock.find(s => s.stock_id === stockId);

        if (!stock) return;

        const available = stock.quantity - stock.reserved;
        if (quantity > available) {
            setError(`Недостаточно товара. Доступно: ${available}`);
            return;
        }

        const updatedItems = [...shipmentForm.items];
        const existingReservation = updatedItems[itemIndex].reservations.find(r => r.stock_id === stockId);

        if (existingReservation) {
            existingReservation.reserved_qty = quantity;
        } else {
            updatedItems[itemIndex].reservations.push({
                stock_id: stockId,
                reserved_qty: quantity,
                picked_qty: 0
            });
        }

        setShipmentForm({...shipmentForm, items: updatedItems});
        setError('');
    };

    const handleSubmit = () => {
        const allReserved = shipmentForm.items.every(item => {
            const totalReserved = item.reservations.reduce((sum, r) => sum + parseFloat(r.reserved_qty || 0), 0);
            return totalReserved >= parseFloat(item.planned_quantity);
        });

        if (!allReserved) {
            setError('Не все товары зарезервированы');
            return;
        }

        const newShipment = {
            shipment_id: String(shipments.length + 1),
            created_at: new Date().toISOString(),
            status: 'pending',
            ...shipmentForm,
            items: shipmentForm.items.map((item, index) => ({
                shipment_item_id: `${shipments.length + 1}-${index + 1}`,
                ...item,
                actual_quantity: 0
            }))
        };

        setShipments([...shipments, newShipment]);
        handleCloseDialog();
        setSuccess('Заявка на отгрузку создана успешно');
        setError('');
    };

    const handleViewShipment = (shipment) => {
        setSelectedShipment(shipment);
        setViewDialog(true);
    };

    const handleOpenScanDialog = (shipment) => {
        setSelectedShipment({...shipment});
        setScanDialog(true);
        setScanInput('');
    };

    const handleScan = () => {
        if (!scanInput.trim()) {
            setError('Введите SKU, штрихкод или номер партии');
            return;
        }

        if (!scanQuantity || parseFloat(scanQuantity) <= 0) {
            setError('Укажите корректное количество');
            return;
        }

        const product = mockProducts.find(p =>
            p.sku.toLowerCase() === scanInput.toLowerCase() ||
            p.barcode === scanInput.trim()
        );

        const stock = mockStock.find(s => s.batch_number === scanInput.trim());

        if (!product && !stock) {
            setError('Товар или партия не найдены');
            setScanInput('');
            return;
        }

        const targetProductId = product ? product.product_id : stock.product_id;

        const itemIndex = selectedShipment.items.findIndex(item =>
            item.product_id === targetProductId &&
            (item.actual_quantity || 0) < item.planned_quantity
        );

        if (itemIndex === -1) {
            setError('Этот товар уже полностью собран или не найден в заявке');
            setScanInput('');
            return;
        }

        const item = selectedShipment.items[itemIndex];
        const remaining = item.planned_quantity - (item.actual_quantity || 0);
        const quantityToAdd = Math.min(parseFloat(scanQuantity), remaining);

        const updatedItems = [...selectedShipment.items];
        updatedItems[itemIndex] = {
            ...item,
            actual_quantity: (item.actual_quantity || 0) + quantityToAdd
        };

        const updatedShipment = {...selectedShipment, items: updatedItems};
        setSelectedShipment(updatedShipment);

        const productInfo = mockProducts.find(p => p.product_id === targetProductId);
        setSuccess(`✓ Отсканировано: ${productInfo?.name} (${stock?.batch_number || 'без партии'}) - ${quantityToAdd} ${productInfo?.unit}`);
        setScanInput('');
        setScanQuantity(1);
        setError('');

        const allScanned = updatedItems.every(item =>
            (item.actual_quantity || 0) >= item.planned_quantity
        );

        if (allScanned) {
            updatedShipment.status = 'completed';
            setSuccess('🎉 Все товары собраны! Отгрузка завершена.');
        } else {
            if (updatedShipment.status === 'pending') {
                updatedShipment.status = 'in_progress';
            }
        }

        setShipments(shipments.map(s =>
            s.shipment_id === updatedShipment.shipment_id ? updatedShipment : s
        ));
    };

    const handleCompleteShipment = () => {
        if (!selectedShipment) return;

        const updatedShipment = {
            ...selectedShipment,
            status: 'completed'
        };

        setShipments(shipments.map(s =>
            s.shipment_id === updatedShipment.shipment_id ? updatedShipment : s
        ));

        setSuccess('Отгрузка успешно завершена!');
        setScanDialog(false);
        setSelectedShipment(null);
    };

    const handleDeleteShipment = (shipmentId) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту заявку?')) {
            return;
        }
        setShipments(shipments.filter(s => s.shipment_id !== shipmentId));
        setSuccess('Заявка удалена');
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'success';
            case 'in_progress':
                return 'info';
            case 'pending':
                return 'warning';
            case 'cancelled':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusLabel = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'Завершено';
            case 'in_progress':
                return 'В сборке';
            case 'pending':
                return 'Ожидает';
            case 'cancelled':
                return 'Отменено';
            default:
                return status || 'Неизвестно';
        }
    };

    const getProductInfo = (productId) => {
        return mockProducts.find(p => p.product_id === productId);
    };

    const getStockInfo = (stockId) => {
        return mockStock.find(s => s.stock_id === stockId);
    };

    const calculateProgress = (items) => {
        if (!items || items.length === 0) return 0;
        const total = items.reduce((sum, item) => sum + parseFloat(item.planned_quantity || 0), 0);
        const scanned = items.reduce((sum, item) => sum + parseFloat(item.actual_quantity || 0), 0);
        return total > 0 ? (scanned / total) * 100 : 0;
    };

    const filteredShipments = shipments.filter(s => {
        if (tabValue === 0) return s.status !== 'completed' && s.status !== 'cancelled';
        if (tabValue === 1) return s.status === 'completed';
        if (tabValue === 2) return s.status === 'cancelled';
        return true;
    });

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight={700}>Отгрузка товара</Typography>
                <Button variant="contained" startIcon={<AddIcon/>} onClick={handleOpenDialog}>
                    Создать заявку
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{mb: 2}} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{mb: 2}} onClose={() => setSuccess('')}>{success}</Alert>}

            <Paper sx={{mb: 2}}>
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                    <Tab label={
                        <Badge badgeContent={shipments.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length} color="primary">
                            Активные
                        </Badge>
                    }/>
                    <Tab label="Завершенные"/>
                    <Tab label="Отмененные"/>
                </Tabs>
            </Paper>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>Номер</strong></TableCell>
                            <TableCell><strong>Дата создания</strong></TableCell>
                            <TableCell><strong>Получатель</strong></TableCell>
                            <TableCell><strong>Позиций</strong></TableCell>
                            <TableCell><strong>Прогресс</strong></TableCell>
                            <TableCell><strong>Статус</strong></TableCell>
                            <TableCell align="right"><strong>Действия</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredShipments.map((shipment) => {
                            const progress = calculateProgress(shipment.items);
                            return (
                                <TableRow key={shipment.shipment_id}>
                                    <TableCell>№{shipment.shipment_id}</TableCell>
                                    <TableCell>{new Date(shipment.created_at).toLocaleString('ru-RU')}</TableCell>
                                    <TableCell>{shipment.customer_name}</TableCell>
                                    <TableCell>{shipment.items?.length || 0}</TableCell>
                                    <TableCell>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, minWidth: 120}}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={progress}
                                                sx={{flexGrow: 1, height: 8, borderRadius: 4}}
                                            />
                                            <Typography variant="body2">{progress.toFixed(0)}%</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={getStatusLabel(shipment.status)} color={getStatusColor(shipment.status)} size="small"/>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleViewShipment(shipment)}>
                                            <VisibilityIcon/>
                                        </IconButton>
                                        {shipment.status !== 'completed' && shipment.status !== 'cancelled' && (
                                            <IconButton size="small" color="primary" onClick={() => handleOpenScanDialog(shipment)}>
                                                <LocalShippingIcon/>
                                            </IconButton>
                                        )}
                                        {shipment.status === 'pending' && (
                                            <IconButton size="small" color="error" onClick={() => handleDeleteShipment(shipment.shipment_id)}>
                                                <DeleteIcon/>
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredShipments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Typography color="text.secondary" sx={{py: 2}}>Нет данных</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
                <DialogTitle>Создание заявки на отгрузку</DialogTitle>
                <DialogContent>
                    <Stepper activeStep={activeStep} sx={{pt: 3, pb: 3}}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {activeStep === 0 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Информация о заявке</Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Получатель (организация или ФИО)"
                                        value={shipmentForm.customer_name}
                                        onChange={(e) => setShipmentForm({...shipmentForm, customer_name: e.target.value})}
                                        required
                                        placeholder="ООО «Торговый дом»"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Желаемая дата отгрузки"
                                        type="date"
                                        value={shipmentForm.desired_date}
                                        onChange={(e) => setShipmentForm({...shipmentForm, desired_date: e.target.value})}
                                        slotProps={{inputLabel: {shrink: true}}}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        label="Комментарий (опционально)"
                                        value={shipmentForm.comment}
                                        onChange={(e) => setShipmentForm({...shipmentForm, comment: e.target.value})}
                                        placeholder="Дополнительная информация о заявке..."
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {activeStep === 1 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Добавление товаров</Typography>

                            <Card sx={{mb: 3, bgcolor: 'primary.50'}}>
                                <CardContent>
                                    <Typography variant="subtitle2" gutterBottom>Поиск товара</Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={8}>
                                            <Autocomplete
                                                freeSolo
                                                options={mockProducts}
                                                getOptionLabel={(option) =>
                                                    typeof option === 'string' ? option : `${option.name} (SKU: ${option.sku})`
                                                }
                                                value={mockProducts.find(p => p.product_id === currentItem.product_id) || null}
                                                inputValue={searchInput}
                                                onInputChange={(e, newValue) => {
                                                    if (e && e.type !== 'click') {
                                                        setSearchInput(newValue);
                                                    }
                                                }}
                                                onChange={(e, newValue) => {
                                                    if (newValue && typeof newValue !== 'string') {
                                                        setCurrentItem({...currentItem, product_id: newValue.product_id});
                                                        setSearchInput(newValue.name);
                                                        const stocks = mockStock.filter(s => s.product_id === newValue.product_id);
                                                        const stocksWithAvailable = stocks.map(s => ({
                                                            ...s,
                                                            available: s.quantity - s.reserved
                                                        })).filter(s => s.available > 0);
                                                        setAvailableStock(stocksWithAvailable);
                                                    } else {
                                                        setCurrentItem({...currentItem, product_id: ''});
                                                        setAvailableStock([]);
                                                    }
                                                }}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Название, SKU или штрихкод"
                                                        placeholder="Начните вводить..."
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && searchInput && !currentItem.product_id) {
                                                                handleSearchProduct();
                                                            }
                                                        }}
                                                    />
                                                )}
                                                renderOption={(props, option) => (
                                                    <li {...props} key={option.product_id}>
                                                        <Box>
                                                            <Typography variant="body1">{option.name}</Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                SKU: {option.sku} | Штрихкод: {option.barcode}
                                                            </Typography>
                                                        </Box>
                                                    </li>
                                                )}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={2}>
                                            <TextField
                                                fullWidth
                                                label="Количество"
                                                type="number"
                                                value={currentItem.planned_quantity}
                                                onChange={(e) => setCurrentItem({...currentItem, planned_quantity: e.target.value})}
                                                slotProps={{htmlInput: {min: 0, step: 1}}}
                                                required
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={2}>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddIcon/>}
                                                onClick={handleAddItemToRequest}
                                                fullWidth
                                                sx={{height: '56px'}}
                                                disabled={!currentItem.product_id || !currentItem.planned_quantity}
                                            >
                                                Добавить
                                            </Button>
                                        </Grid>
                                    </Grid>

                                    {availableStock.length > 0 && currentItem.product_id && (
                                        <Box sx={{mt: 2}}>
                                            <Alert severity="info" icon={<InventoryIcon/>}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    Доступно на складе: {availableStock.reduce((sum, s) => sum + s.available, 0)} {getProductInfo(currentItem.product_id)?.unit}
                                                </Typography>
                                                <Typography variant="caption">
                                                    В {availableStock.length} партиях на складе
                                                </Typography>
                                            </Alert>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>

                            <Divider sx={{my: 2}}/>

                            <Typography variant="subtitle2" gutterBottom>Товары в заявке:</Typography>
                            {shipmentForm.items.length === 0 ? (
                                <Alert severity="warning">Добавьте товары в заявку</Alert>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell><strong>№</strong></TableCell>
                                                <TableCell><strong>Товар</strong></TableCell>
                                                <TableCell><strong>SKU</strong></TableCell>
                                                <TableCell><strong>Количество</strong></TableCell>
                                                <TableCell><strong>Доступно</strong></TableCell>
                                                <TableCell align="right"><strong>Действия</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {shipmentForm.items.map((item, index) => {
                                                const product = getProductInfo(item.product_id);
                                                const totalAvailable = mockStock
                                                    .filter(s => s.product_id === item.product_id)
                                                    .reduce((sum, s) => sum + (s.quantity - s.reserved), 0);
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell>{product?.name}</TableCell>
                                                        <TableCell>{product?.sku}</TableCell>
                                                        <TableCell>{item.planned_quantity} {product?.unit}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={`${totalAvailable} ${product?.unit}`}
                                                                color={totalAvailable >= item.planned_quantity ? 'success' : 'error'}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                                                                <DeleteIcon fontSize="small"/>
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    )}

                    {activeStep === 2 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Резервирование товаров</Typography>
                            <Alert severity="info" sx={{mb: 2}}>
                                Выберите партии и места хранения для каждого товара. Система автоматически подберет партии по принципу FEFO (сначала с меньшим сроком годности).
                            </Alert>

                            {shipmentForm.items.map((item, itemIndex) => {
                                const product = getProductInfo(item.product_id);
                                const stocks = mockStock
                                    .filter(s => s.product_id === item.product_id)
                                    .map(s => ({...s, available: s.quantity - s.reserved}))
                                    .filter(s => s.available > 0)
                                    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

                                const totalReserved = item.reservations.reduce((sum, r) => sum + parseFloat(r.reserved_qty || 0), 0);
                                const isFullyReserved = totalReserved >= parseFloat(item.planned_quantity);

                                return (
                                    <Card key={itemIndex} sx={{mb: 2}}>
                                        <CardContent>
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                                <Box>
                                                    <Typography variant="subtitle1" fontWeight={600}>
                                                        {product?.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        SKU: {product?.sku} | Требуется: {item.planned_quantity} {product?.unit}
                                                    </Typography>
                                                </Box>
                                                <Box display="flex" gap={1} alignItems="center">
                                                    {isFullyReserved ? (
                                                        <Chip
                                                            icon={<WarningIcon/>}
                                                            label={`Зарезервировано: ${totalReserved.toFixed(0)} ${product?.unit}`}
                                                            color="success"
                                                        />
                                                    ) : (
                                                        <Chip
                                                            icon={<WarningIcon/>}
                                                            label={`Осталось: ${(item.planned_quantity - totalReserved).toFixed(0)} ${product?.unit}`}
                                                            color="warning"
                                                        />
                                                    )}
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<WarningIcon/>}
                                                        onClick={() => handleAutoReserve(itemIndex)}
                                                    >
                                                        Авто (FEFO)
                                                    </Button>
                                                </Box>
                                            </Box>

                                            <TableContainer>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell><strong>Партия</strong></TableCell>
                                                            <TableCell><strong>Склад / Место</strong></TableCell>
                                                            <TableCell><strong>Доступно</strong></TableCell>
                                                            <TableCell><strong>Срок годности</strong></TableCell>
                                                            <TableCell><strong>Резерв</strong></TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {stocks.map((stock) => {
                                                            const reservation = item.reservations.find(r => r.stock_id === stock.stock_id);
                                                            const daysToExpiry = Math.ceil((new Date(stock.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));

                                                            return (
                                                                <TableRow key={stock.stock_id}>
                                                                    <TableCell>{stock.batch_number}</TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2">{stock.warehouse_name}</Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {stock.rack_name} {stock.place_name ? ` / ${stock.place_name}` : ''}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>{stock.available} {product?.unit}</TableCell>
                                                                    <TableCell>
                                                                        <Chip
                                                                            label={`${daysToExpiry} дн.`}
                                                                            color={daysToExpiry < 7 ? 'error' : daysToExpiry < 14 ? 'warning' : 'success'}
                                                                            size="small"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <TextField
                                                                            type="number"
                                                                            size="small"
                                                                            value={reservation?.reserved_qty || ''}
                                                                            onChange={(e) => handleManualReserve(itemIndex, stock.stock_id, parseFloat(e.target.value) || 0)}
                                                                            slotProps={{htmlInput: {min: 0, max: stock.available, step: 1}}}
                                                                            sx={{width: 100}}
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>

                                            {item.reservations.length > 0 && (
                                                <Box sx={{mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 1}}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        Сводка резервирования:
                                                    </Typography>
                                                    {item.reservations.map((res, idx) => {
                                                        const stock = getStockInfo(res.stock_id);
                                                        return (
                                                            <Typography key={idx} variant="caption" display="block">
                                                                • Партия {stock?.batch_number}: {res.reserved_qty} {product?.unit} из {stock?.warehouse_name}
                                                            </Typography>
                                                        );
                                                    })}
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Отмена</Button>
                    {activeStep > 0 && <Button onClick={handleBack}>Назад</Button>}
                    {activeStep < 2 ? (
                        <Button onClick={handleNext} variant="contained">
                            Далее
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} variant="contained">
                            Создать заявку
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Детали отгрузки №{selectedShipment?.shipment_id}</DialogTitle>
                <DialogContent>
                    {selectedShipment && (
                        <Box>
                            <Grid container spacing={2} sx={{mb: 2}}>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Получатель:</Typography>
                                    <Typography variant="body1">{selectedShipment.customer_name}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Дата создания:</Typography>
                                    <Typography variant="body1">{new Date(selectedShipment.created_at).toLocaleString('ru-RU')}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="text.secondary">Статус:</Typography>
                                    <Chip label={getStatusLabel(selectedShipment.status)} color={getStatusColor(selectedShipment.status)} size="small"/>
                                </Grid>
                                {selectedShipment.comment && (
                                    <Grid item xs={12}>
                                        <Typography variant="body2" color="text.secondary">Комментарий:</Typography>
                                        <Typography variant="body1">{selectedShipment.comment}</Typography>
                                    </Grid>
                                )}
                            </Grid>

                            <Divider sx={{my: 2}}/>

                            <Typography variant="h6" gutterBottom>Товары</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Товар</TableCell>
                                            <TableCell>Планово</TableCell>
                                            <TableCell>Собрано</TableCell>
                                            <TableCell>Прогресс</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedShipment.items?.map((item, index) => {
                                            const product = getProductInfo(item.product_id);
                                            return (
                                                <TableRow key={index}>
                                                    <TableCell>{product?.name}</TableCell>
                                                    <TableCell>{item.planned_quantity} {product?.unit}</TableCell>
                                                    <TableCell>{item.actual_quantity || 0} {product?.unit}</TableCell>
                                                    <TableCell>
                                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={((item.actual_quantity || 0) / item.planned_quantity) * 100}
                                                                sx={{flexGrow: 1, height: 6, borderRadius: 3}}
                                                            />
                                                            <Typography variant="caption">
                                                                {(((item.actual_quantity || 0) / item.planned_quantity) * 100).toFixed(0)}%
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setViewDialog(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={scanDialog} onClose={() => setScanDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        <LocalShippingIcon/>
                        Сборка заявки №{selectedShipment?.shipment_id}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {selectedShipment && (
                        <Box>
                            <Card sx={{mb: 3, bgcolor: 'primary.50'}}>
                                <CardContent>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                        <Typography variant="h6">Прогресс сборки</Typography>
                                        <Chip
                                            icon={<LocalShippingIcon/>}
                                            label={`${calculateProgress(selectedShipment.items).toFixed(0)}%`}
                                            color={calculateProgress(selectedShipment.items) === 100 ? 'success' : 'primary'}
                                        />
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={calculateProgress(selectedShipment.items)}
                                        sx={{height: 10, borderRadius: 5}}
                                    />
                                </CardContent>
                            </Card>

                            <Box sx={{mb: 3}}>
                                <TextField
                                    fullWidth
                                    label="Сканируйте SKU, штрихкод или номер партии"
                                    value={scanInput}
                                    onChange={(e) => setScanInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                    autoFocus
                                    placeholder="Например: MILK-001 или 4607025392201 или B-2025-001"
                                    slotProps={{
                                        input: {
                                            endAdornment: (
                                                <Button onClick={handleScan} variant="contained">
                                                    Сканировать
                                                </Button>
                                            )
                                        }
                                    }}
                                />
                            </Box>

                            <TextField
                                fullWidth
                                label="Количество"
                                type="number"
                                value={scanQuantity}
                                onChange={(e) => setScanQuantity(e.target.value)}
                                slotProps={{htmlInput: {min: 1, step: 1}}}
                                sx={{mb: 3}}
                            />

                            <Typography variant="h6" gutterBottom>Лист подбора</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Товар</TableCell>
                                            <TableCell>SKU</TableCell>
                                            <TableCell>План</TableCell>
                                            <TableCell>Собрано</TableCell>
                                            <TableCell>Статус</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedShipment.items?.map((item, index) => {
                                            const product = getProductInfo(item.product_id);
                                            const isComplete = (item.actual_quantity || 0) >= item.planned_quantity;
                                            return (
                                                <TableRow key={index} sx={{bgcolor: isComplete ? 'success.50' : 'inherit'}}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{product?.name}</Typography>
                                                        {item.reservations && item.reservations.length > 0 && (
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                Партии: {item.reservations.map(r => getStockInfo(r.stock_id)?.batch_number).join(', ')}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{product?.sku}</TableCell>
                                                    <TableCell>{item.planned_quantity} {product?.unit}</TableCell>
                                                    <TableCell>
                                                        <strong>{item.actual_quantity || 0}</strong> {product?.unit}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isComplete ? (
                                                            <Chip icon={<WarningIcon/>} label="✓ Готово" color="success" size="small"/>
                                                        ) : (
                                                            <Chip
                                                                label={`Осталось: ${item.planned_quantity - (item.actual_quantity || 0)} ${product?.unit}`}
                                                                color="warning"
                                                                size="small"
                                                            />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setScanDialog(false)}>Закрыть</Button>
                    {selectedShipment && calculateProgress(selectedShipment.items) === 100 && (
                        <Button variant="contained" color="success" startIcon={<WarningIcon/>} onClick={handleCompleteShipment}>
                            Завершить отгрузку
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ShipPage;
