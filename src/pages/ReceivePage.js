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
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stepper,
    Step,
    StepLabel,
    Chip,
    Alert,
    Autocomplete,
    Divider,
    Card,
    CardContent,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const steps = ['Данные поставки', 'Товары', 'Добавление поставок товара', 'Размещение поставок'];

const initialSuppliers = [
    {supplier_id: '1', name: 'ООО "Поставщик 1"', inn: '7701234567'},
    {supplier_id: '2', name: 'ЗАО "Поставщик 2"', inn: '7702345678'},
    {supplier_id: '3', name: 'ИП Иванов', inn: '770345678901'},
];

const mockProducts = [
    {product_id: '1', name: 'Молоко 3.2%', sku: 'MILK-001', unit: 'л'},
    {product_id: '2', name: 'Хлеб белый', sku: 'BREAD-001', unit: 'шт'},
    {product_id: '3', name: 'Масло сливочное', sku: 'BUTTER-001', unit: 'кг'},
    {product_id: '4', name: 'Яйца куриные', sku: 'EGGS-001', unit: 'шт'},
    {product_id: '5', name: 'Сахар', sku: 'SUGAR-001', unit: 'кг'},
];

const mockWarehouses = [
    {warehouse_id: '1', name: 'Основной склад'},
    {warehouse_id: '2', name: 'Холодильный склад'},
];

const mockRacks = {
    '1': [
        {rack_id: '1-1', name: 'Стеллаж A1', rack_kind: 'обычный'},
        {rack_id: '1-2', name: 'Стеллаж A2', rack_kind: 'обычный'},
        {rack_id: '1-3', name: 'Стеллаж B1', rack_kind: 'обычный'},
    ],
    '2': [
        {rack_id: '2-1', name: 'Холодильная камера 1', rack_kind: 'холодильник'},
        {rack_id: '2-2', name: 'Холодильная камера 2', rack_kind: 'холодильник'},
    ],
};

const mockPlaces = {
    '1-1': [
        {place_id: '1-1-1', name: 'Полка 1'},
        {place_id: '1-1-2', name: 'Полка 2'},
        {place_id: '1-1-3', name: 'Полка 3'},
    ],
    '1-2': [
        {place_id: '1-2-1', name: 'Полка 1'},
        {place_id: '1-2-2', name: 'Полка 2'},
    ],
};

const ReceivePage = () => {
    const [deliveries, setDeliveries] = useState([
        {
            delivery_id: '1',
            delivery_number: 'ПН-001',
            delivery_date: '2025-01-15',
            supplier_id: '1',
            status: 'Принято',
            items: [
                {product_id: '1', planned_quantity: 100, price_per_unit: 75},
                {product_id: '2', planned_quantity: 50, price_per_unit: 45}
            ]
        },
        {
            delivery_id: '2',
            delivery_number: 'ПН-002',
            delivery_date: '2025-01-16',
            supplier_id: '2',
            status: 'В обработке',
            items: [
                {product_id: '3', planned_quantity: 30, price_per_unit: 250}
            ]
        },
    ]);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [suppliers, setSuppliers] = useState(initialSuppliers);
    const [products, setProducts] = useState(mockProducts);
    const [addSupplierOpen, setAddSupplierOpen] = useState(false);
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState({ name: '', inn: '' });
    const [newProduct, setNewProduct] = useState({
        name: '',
        sku: '',
        unit: 'шт',
        description: '',
        category: ''
    });
    const [editingItemIndex, setEditingItemIndex] = useState(null);

    const [openDialog, setOpenDialog] = useState(false);
    const [viewDialog, setViewDialog] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState(null);

    const [activeStep, setActiveStep] = useState(0);
    const [deliveryForm, setDeliveryForm] = useState({
        delivery_number: '',
        delivery_date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        items: []
    });

    const [currentItem, setCurrentItem] = useState({
        product_id: '',
        planned_quantity: '',
        price_per_unit: '',
        batches: []
    });

    const [currentBatch, setCurrentBatch] = useState({
        batch_number: '',
        quantity: '',
        production_date: '',
        expiry_date: ''
    });

    const [manualPlacement, setManualPlacement] = useState(true);

    const generateSKU = (productName, category) => {
        const categoryPrefix = category ? category.substring(0, 3).toUpperCase() : 'PRD';
        const namePrefix = productName.substring(0, 3).toUpperCase().replace(/[^A-ZА-Я]/g, '');
        const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        return `${categoryPrefix}-${namePrefix}-${randomNum}`;
    };

    const handleAutoPlaceBatches = (itemIndex) => {
        const item = deliveryForm.items[itemIndex];
        if (!item.product_id || !item.planned_quantity) {
            setError('Товар и количество не указаны');
            return;
        }

        const product = getProductInfo(item.product_id);

        let targetWarehouse = mockWarehouses[0];

        if (product?.category && (
            product.category.toLowerCase().includes('молоч') ||
            product.category.toLowerCase().includes('мясн') ||
            product.category.toLowerCase().includes('яй')
        )) {
            targetWarehouse = mockWarehouses.find(w => w.name.includes('Холодильный')) || mockWarehouses[0];
        }

        const availableRacks = mockRacks[targetWarehouse.warehouse_id] || [];

        if (availableRacks.length === 0) {
            setError('Нет доступных стеллажей на складе');
            return;
        }

        const targetRack = availableRacks[0];

        const availablePlaces = mockPlaces[targetRack.rack_id] || [];

        const batchNumber = `B-${new Date().getFullYear()}-${String(deliveries.length + 1).padStart(3, '0')}-${String(itemIndex + 1).padStart(2, '0')}`;

        const newBatch = {
            batch_number: batchNumber,
            quantity: item.planned_quantity,
            production_date: new Date().toISOString().split('T')[0],
            expiry_date: '',
            warehouse_id: targetWarehouse.warehouse_id,
            rack_id: targetRack.rack_id,
            place_id: availablePlaces.length > 0 ? availablePlaces[0].place_id : ''
        };

        const updatedItems = [...deliveryForm.items];
        updatedItems[itemIndex].batches = [newBatch];
        setDeliveryForm({...deliveryForm, items: updatedItems});

        setSuccess(`Автоматически размещено на ${targetWarehouse.name} → ${targetRack.name}${availablePlaces.length > 0 ? ` → ${availablePlaces[0].name}` : ''}`);
        setError('');
    };

    const handleOpenDialog = () => {
        setOpenDialog(true);
        setActiveStep(0);
        setDeliveryForm({
            delivery_number: `ПН-${String(deliveries.length + 1).padStart(3, '0')}`,
            delivery_date: new Date().toISOString().split('T')[0],
            supplier_id: '',
            items: []
        });
        setEditingItemIndex(null);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setActiveStep(0);
        setCurrentItem({
            product_id: '',
            planned_quantity: '',
            price_per_unit: '',
            batches: []
        });
        setEditingItemIndex(null);
    };

    const handleViewDelivery = (delivery) => {
        setSelectedDelivery(delivery);
        setViewDialog(true);
    };

    const handleNext = () => {
        if (activeStep === 0 && validateStep1()) {
            setActiveStep(1);
        } else if (activeStep === 1) {
            if (deliveryForm.items.length === 0) {
                setError('Добавьте хотя бы один товар');
                return;
            }
            setActiveStep(2);
            setError('');
        } else if (activeStep === 2) {
            const allItemsHaveBatches = deliveryForm.items.every(item => {
                const totalBatches = item.batches.reduce((sum, b) => sum + parseFloat(b.quantity || 0), 0);
                return totalBatches >= parseFloat(item.planned_quantity);
            });

            if (!allItemsHaveBatches) {
                setError('Не все товары разбиты на партии или количество в партиях меньше планового');
                return;
            }
            setActiveStep(3);
            setError('');
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const validateStep1 = () => {
        if (!deliveryForm.delivery_number || !deliveryForm.delivery_date || !deliveryForm.supplier_id) {
            setError('Заполните все обязательные поля');
            return false;
        }
        setError('');
        return true;
    };

    const handleAddItem = () => {
        if (!currentItem.product_id || !currentItem.planned_quantity) {
            setError('Укажите товар и количество');
            return;
        }

        if (parseFloat(currentItem.planned_quantity) <= 0) {
            setError('Количество должно быть больше 0');
            return;
        }

        if (currentItem.price_per_unit && parseFloat(currentItem.price_per_unit) < 0) {
            setError('Цена не может быть отрицательной');
            return;
        }

        if (editingItemIndex !== null) {
            const updatedItems = [...deliveryForm.items];
            updatedItems[editingItemIndex] = {...currentItem};
            setDeliveryForm({
                ...deliveryForm,
                items: updatedItems
            });
            setEditingItemIndex(null);
            setSuccess('Товар обновлен');
        } else {
            setDeliveryForm({
                ...deliveryForm,
                items: [...deliveryForm.items, {...currentItem, batches: []}]
            });
            setSuccess('Товар добавлен в поставку');
        }

        setCurrentItem({
            product_id: '',
            planned_quantity: '',
            price_per_unit: '',
            batches: []
        });
        setError('');
    };

    const handleProductInputChange = (newValue) => {
        if (newValue) {
            setCurrentItem({
                ...currentItem,
                product_id: newValue.product_id
            });
        } else {
            setCurrentItem({
                ...currentItem,
                product_id: ''
            });
        }
    };

    const handleEditItem = (index) => {
        const item = deliveryForm.items[index];
        setCurrentItem({
            product_id: item.product_id,
            planned_quantity: item.planned_quantity,
            price_per_unit: item.price_per_unit,
            batches: item.batches || []
        });
        setEditingItemIndex(index);
    };

    const handleCancelEdit = () => {
        setEditingItemIndex(null);
        setCurrentItem({
            product_id: '',
            planned_quantity: '',
            price_per_unit: '',
            batches: []
        });
    };

    const handleRemoveItem = (index) => {
        const updatedItems = deliveryForm.items.filter((_, i) => i !== index);
        setDeliveryForm({
            ...deliveryForm,
            items: updatedItems
        });
        if (editingItemIndex === index) {
            setEditingItemIndex(null);
            setCurrentItem({
                product_id: '',
                planned_quantity: '',
                price_per_unit: '',
                batches: []
            });
        }
    };

    const handleAddBatchToItem = (itemIndex) => {
        if (!currentBatch.batch_number || !currentBatch.quantity) {
            setError('Укажите номер партии и количество');
            return;
        }

        if (parseFloat(currentBatch.quantity) <= 0) {
            setError('Количество партии должно быть больше 0');
            return;
        }

        if (currentBatch.production_date) {
            const productionDate = new Date(currentBatch.production_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (productionDate > today) {
                setError('Дата производства не может быть в будущем');
                return;
            }
        }

        if (currentBatch.production_date && currentBatch.expiry_date) {
            const productionDate = new Date(currentBatch.production_date);
            const expiryDate = new Date(currentBatch.expiry_date);

            if (expiryDate <= productionDate) {
                setError('Срок годности должен быть позже даты производства');
                return;
            }
        }

        const item = deliveryForm.items[itemIndex];
        const totalBatches = item.batches.reduce((sum, b) => sum + parseFloat(b.quantity), 0);

        if (totalBatches + parseFloat(currentBatch.quantity) > parseFloat(item.planned_quantity)) {
            setError(`Общее количество в партиях превышает плановое количество (${item.planned_quantity})`);
            return;
        }

        const updatedItems = [...deliveryForm.items];
        updatedItems[itemIndex].batches.push({...currentBatch});
        setDeliveryForm({...deliveryForm, items: updatedItems});

        setCurrentBatch({
            batch_number: '',
            quantity: '',
            production_date: '',
            expiry_date: ''
        });
        setError('');
        setSuccess('Партия добавлена');
    };

    const handleRemoveBatchFromItem = (itemIndex, batchIndex) => {
        const updatedItems = [...deliveryForm.items];
        updatedItems[itemIndex].batches = updatedItems[itemIndex].batches.filter((_, i) => i !== batchIndex);
        setDeliveryForm({...deliveryForm, items: updatedItems});
    };

    const handleSubmit = () => {
        if (manualPlacement) {
            const allPlaced = deliveryForm.items.every(item =>
                item.warehouse_id && item.rack_id
            );

            if (!allPlaced) {
                setError('Не все товары размещены. Выберите склад и стеллаж для каждого товара.');
                return;
            }
        }

        const newDelivery = {
            delivery_id: String(deliveries.length + 1),
            ...deliveryForm,
            status: 'Принято'
        };

        setDeliveries([...deliveries, newDelivery]);
        handleCloseDialog();
        setSuccess('Поставка успешно создана');
        setError('');
    };

    const handleAddSupplier = () => {
        if (!newSupplier.name.trim()) {
            setError('Введите название поставщика');
            return;
        }
        const newId = (suppliers.length + 1).toString();
        const supplier = { supplier_id: newId, name: newSupplier.name, inn: newSupplier.inn };
        setSuppliers([...suppliers, supplier]);
        setAddSupplierOpen(false);
        setNewSupplier({ name: '', inn: '' });
        setDeliveryForm({ ...deliveryForm, supplier_id: newId });
        setError('');
    };

    const handleAddProduct = () => {
        if (!newProduct.name.trim()) {
            setError('Введите название товара');
            return;
        }

        const generatedSKU = generateSKU(newProduct.name, newProduct.category);

        const newId = (products.length + 1).toString();
        const product = {
            product_id: newId,
            name: newProduct.name,
            sku: generatedSKU,
            unit: newProduct.unit,
            description: newProduct.description,
            category: newProduct.category
        };
        setProducts([...products, product]);
        setAddProductOpen(false);
        setNewProduct({ name: '', sku: '', unit: 'шт', description: '', category: '' });
        setCurrentItem({ ...currentItem, product_id: newId });
        setError('');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Принято':
                return 'success';
            case 'В обработке':
                return 'warning';
            case 'Отменено':
                return 'error';
            default:
                return 'default';
        }
    };

    const getProductName = (productId) => {
        const product = products.find(p => p.product_id === productId);
        return product ? product.name : productId;
    };

    const getProductInfo = (productId) => {
        return products.find(p => p.product_id === productId);
    };

    const getSupplierName = (supplierId) => {
        const supplier = suppliers.find(s => s.supplier_id === supplierId);
        return supplier ? supplier.name : supplierId;
    };

    const getWarehouseName = (warehouseId) => {
        const warehouse = mockWarehouses.find(w => w.warehouse_id === warehouseId);
        return warehouse ? warehouse.name : warehouseId;
    };

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight={700}>Прием товара</Typography>
                <Button variant="contained" startIcon={<AddIcon/>} onClick={handleOpenDialog}>
                    Новая поставка
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{mb: 2}} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{mb: 2}} onClose={() => setSuccess('')}>{success}</Alert>}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>Номер накладной</strong></TableCell>
                            <TableCell><strong>Дата</strong></TableCell>
                            <TableCell><strong>Поставщик</strong></TableCell>
                            <TableCell><strong>Статус</strong></TableCell>
                            <TableCell align="right"><strong>Действия</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {deliveries.map((delivery) => (
                            <TableRow key={delivery.delivery_id}>
                                <TableCell>{delivery.delivery_number}</TableCell>
                                <TableCell>{new Date(delivery.delivery_date).toLocaleDateString('ru-RU')}</TableCell>
                                <TableCell>{getSupplierName(delivery.supplier_id)}</TableCell>
                                <TableCell>
                                    <Chip label={delivery.status || 'В обработке'}
                                          color={getStatusColor(delivery.status)} size="small"/>
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleViewDelivery(delivery)}>
                                        <VisibilityIcon/>
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {deliveries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography color="text.secondary">Нет данных</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                <DialogTitle>Создание поставки</DialogTitle>
                <DialogContent>
                    <Stepper activeStep={activeStep} sx={{pt: 3, pb: 3}}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {activeStep === 0 && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Номер накладной"
                                    value={deliveryForm.delivery_number}
                                    onChange={(e) => setDeliveryForm({
                                        ...deliveryForm,
                                        delivery_number: e.target.value
                                    })}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Дата поставки"
                                    type="date"
                                    value={deliveryForm.delivery_date}
                                    onChange={(e) => setDeliveryForm({...deliveryForm, delivery_date: e.target.value})}
                                    slotProps={{inputLabel: {shrink: true}}}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} container alignItems="center" spacing={1}>
                                <Grid item xs>
                                    <TextField
                                        fullWidth
                                        select
                                        label="Поставщик"
                                        value={deliveryForm.supplier_id}
                                        onChange={(e) => setDeliveryForm({...deliveryForm, supplier_id: e.target.value})}
                                        required
                                    >
                                        {suppliers.map((supplier) => (
                                            <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                                                {supplier.name} {supplier.inn && `(УНП: ${supplier.inn})`}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid item>
                                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddSupplierOpen(true)}>
                                        Добавить
                                    </Button>
                                </Grid>
                            </Grid>
                        </Grid>
                    )}

                    {activeStep === 1 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Добавление товаров</Typography>

                            {editingItemIndex !== null && (
                                <Alert severity="info" sx={{mb: 2}}>
                                    Режим редактирования товара #{editingItemIndex + 1}
                                    <Button size="small" onClick={handleCancelEdit} sx={{ml: 2}}>
                                        Отменить редактирование
                                    </Button>
                                </Alert>
                            )}

                            <Grid container spacing={2} sx={{mb: 2}}>
                                <Grid item xs={12}>
                                    <Box display="flex" gap={1}>
                                        <Autocomplete
                                            fullWidth
                                            options={products}
                                            getOptionLabel={(option) => `${option.name} (Артикул: ${option.sku})`}
                                            value={products.find(p => p.product_id === currentItem.product_id) || null}
                                            onChange={(event, newValue) => {
                                                handleProductInputChange(newValue);
                                            }}
                                            renderInput={(params) => <TextField {...params} label="Поиск товара по названию или артикулу" required/>}
                                            filterOptions={(options, { inputValue }) => {
                                                return options.filter(option =>
                                                    option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                                                    option.sku.toLowerCase().includes(inputValue.toLowerCase())
                                                );
                                            }}
                                            renderOption={(props, option) => (
                                                <Box component="li" {...props} key={option.product_id}>
                                                    <Box>
                                                        <Typography variant="body1">{option.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Артикул: {option.sku} | Ед. изм.: {option.unit}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                            noOptionsText="Товар не найден"
                                        />
                                        <Button
                                            variant="outlined"
                                            startIcon={<AddIcon />}
                                            onClick={() => setAddProductOpen(true)}
                                            sx={{minWidth: '140px'}}
                                        >
                                            Создать товар
                                        </Button>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Плановое количество"
                                        type="number"
                                        value={currentItem.planned_quantity}
                                        onChange={(e) => setCurrentItem({
                                            ...currentItem,
                                            planned_quantity: e.target.value
                                        })}
                                        slotProps={{htmlInput: {min: 0, step: 0.01}}}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Цена за единицу (руб.)"
                                        type="number"
                                        value={currentItem.price_per_unit}
                                        onChange={(e) => setCurrentItem({
                                            ...currentItem,
                                            price_per_unit: e.target.value
                                        })}
                                        slotProps={{htmlInput: {min: 0, step: 0.01}}}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button
                                        variant="contained"
                                        startIcon={editingItemIndex !== null ? <EditIcon/> : <AddIcon/>}
                                        onClick={handleAddItem}
                                        fullWidth
                                    >
                                        {editingItemIndex !== null ? 'Сохранить изменения' : 'Добавить товар в поставку'}
                                    </Button>
                                </Grid>
                            </Grid>

                            <Divider sx={{my: 2}}/>

                            <Typography variant="subtitle2" gutterBottom>Товары в поставке:</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>№</strong></TableCell>
                                            <TableCell><strong>Товар</strong></TableCell>
                                            <TableCell><strong>Артикул</strong></TableCell>
                                            <TableCell><strong>Количество</strong></TableCell>
                                            <TableCell><strong>Цена</strong></TableCell>
                                            <TableCell><strong>Сумма</strong></TableCell>
                                            <TableCell align="right"><strong>Действия</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {deliveryForm.items.map((item, index) => {
                                            const product = getProductInfo(item.product_id);
                                            const total = (parseFloat(item.planned_quantity) * parseFloat(item.price_per_unit || 0)).toFixed(2);
                                            return (
                                                <TableRow
                                                    key={index}
                                                    sx={{
                                                        backgroundColor: editingItemIndex === index ? 'action.selected' : 'inherit'
                                                    }}
                                                >
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell>{product?.name || '-'}</TableCell>
                                                    <TableCell>{product?.sku || '-'}</TableCell>
                                                    <TableCell>{item.planned_quantity} {product?.unit || ''}</TableCell>
                                                    <TableCell>{item.price_per_unit ? `${item.price_per_unit} руб.` : '-'}</TableCell>
                                                    <TableCell>{item.price_per_unit ? `${total} руб.` : '-'}</TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditItem(index)}
                                                            disabled={editingItemIndex === index}
                                                        >
                                                            <EditIcon fontSize="small"/>
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                                                            <DeleteIcon fontSize="small"/>
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {deliveryForm.items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">
                                                    <Typography color="text.secondary" sx={{py: 2}}>
                                                        Добавьте товары в поставку
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {deliveryForm.items.length > 0 && (
                                <Box sx={{mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1}}>
                                    <Typography variant="subtitle1">
                                        <strong>Итого:</strong> {deliveryForm.items.reduce((sum, item) =>
                                            sum + (parseFloat(item.planned_quantity) * parseFloat(item.price_per_unit || 0)), 0
                                        ).toFixed(2)} руб.
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Всего позиций: {deliveryForm.items.length}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}

                    {activeStep === 2 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Разбиение товаров на партии</Typography>
                            <Alert severity="info" sx={{mb: 2}}>
                                Для каждого товара укажите партии поставки с номером партии, количеством и датами. Общее количество в партиях должно совпадать с плановым количеством товара.
                            </Alert>

                            {deliveryForm.items.length === 0 ? (
                                <Alert severity="warning">Сначала добавьте товары на предыдущем шаге</Alert>
                            ) : (
                                deliveryForm.items.map((item, itemIndex) => {
                                    const product = getProductInfo(item.product_id);
                                    const totalBatches = item.batches.reduce((sum, b) => sum + parseFloat(b.quantity || 0), 0);
                                    const remaining = parseFloat(item.planned_quantity) - totalBatches;
                                    const isComplete = remaining <= 0;

                                    return (
                                        <Card key={itemIndex} sx={{mb: 3}}>
                                            <CardContent>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                                    <Box>
                                                        <Typography variant="subtitle1" fontWeight={600}>
                                                            {product?.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Артикул: {product?.sku} | Всего: {item.planned_quantity} {product?.unit}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={isComplete ? 'Разбито на партии' : `Осталось: ${remaining.toFixed(2)} ${product?.unit}`}
                                                        color={isComplete ? 'success' : 'warning'}
                                                        icon={isComplete ? <CheckCircleIcon /> : undefined}
                                                    />
                                                </Box>

                                                <Divider sx={{mb: 2}} />

                                                <Typography variant="subtitle2" gutterBottom>Добавить партию:</Typography>
                                                <Grid container spacing={2} sx={{mb: 2}}>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            label="Номер партии"
                                                            value={currentBatch.batch_number}
                                                            onChange={e => setCurrentBatch({...currentBatch, batch_number: e.target.value})}
                                                            placeholder="B-2025-001"
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            type="number"
                                                            label={`Количество (${product?.unit})`}
                                                            value={currentBatch.quantity}
                                                            onChange={e => setCurrentBatch({...currentBatch, quantity: e.target.value})}
                                                            slotProps={{htmlInput: {min: 0, step: 0.01, max: remaining}}}
                                                            helperText={!isComplete ? `Доступно: ${remaining.toFixed(2)}` : ''}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            type="date"
                                                            label="Дата производства"
                                                            value={currentBatch.production_date}
                                                            onChange={e => setCurrentBatch({...currentBatch, production_date: e.target.value})}
                                                            slotProps={{inputLabel: {shrink: true}}}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            type="date"
                                                            label="Срок годности"
                                                            value={currentBatch.expiry_date}
                                                            onChange={e => setCurrentBatch({...currentBatch, expiry_date: e.target.value})}
                                                            slotProps={{inputLabel: {shrink: true}}}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <Button
                                                            variant="outlined"
                                                            startIcon={<AddIcon />}
                                                            onClick={() => handleAddBatchToItem(itemIndex)}
                                                            fullWidth
                                                            disabled={isComplete}
                                                        >
                                                            Добавить партию
                                                        </Button>
                                                    </Grid>
                                                </Grid>

                                                {item.batches.length > 0 && (
                                                    <>
                                                        <Typography variant="subtitle2" gutterBottom>Партии товара:</Typography>
                                                        <TableContainer>
                                                            <Table size="small">
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell>Партия</TableCell>
                                                                        <TableCell>Количество</TableCell>
                                                                        <TableCell>Дата производства</TableCell>
                                                                        <TableCell>Срок годности</TableCell>
                                                                        <TableCell align="right">Действия</TableCell>
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableBody>
                                                                    {item.batches.map((batch, batchIndex) => (
                                                                        <TableRow key={batchIndex}>
                                                                            <TableCell>{batch.batch_number}</TableCell>
                                                                            <TableCell>{batch.quantity} {product?.unit}</TableCell>
                                                                            <TableCell>
                                                                                {batch.production_date ? new Date(batch.production_date).toLocaleDateString('ru-RU') : '-'}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString('ru-RU') : '-'}
                                                                            </TableCell>
                                                                            <TableCell align="right">
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => handleRemoveBatchFromItem(itemIndex, batchIndex)}
                                                                                >
                                                                                    <DeleteIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </TableContainer>
                                                    </>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </Box>
                    )}

                    {activeStep === 3 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Партии и размещение</Typography>
                            <FormControlLabel
                                control={<Checkbox checked={manualPlacement} onChange={e => setManualPlacement(e.target.checked)} />}
                                label="Ручное размещение"
                                sx={{mb: 2}}
                            />

                            {!manualPlacement && (
                                <Alert severity="info" sx={{mb: 2}}>
                                    При автоматическом размещении система самостоятельно выберет оптимальные места для товаров на основе их категорий и условий хранения.
                                </Alert>
                            )}

                            {!manualPlacement ? (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    sx={{mb: 2}}
                                    onClick={() => {
                                        setSuccess('Запрос на автоматическое размещение отправлен. Товары будут размещены оптимально.');
                                    }}
                                >
                                    Автоматически разместить все партии
                                </Button>
                            ) : (
                                <Box>
                                    <Alert severity="info" sx={{mb: 2}}>
                                        Выберите склад, стеллаж и полку для каждого товара. Обязательно укажите хотя бы склад и стеллаж.
                                    </Alert>
                                    {deliveryForm.items.map((item, idx) => {
                                        const product = products.find(p => p.product_id === item.product_id);
                                        return (
                                            <Card key={idx} sx={{mb: 2}}>
                                                <CardContent>
                                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                                        {product?.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block" sx={{mb: 2}}>
                                                        Артикул: {product?.sku} | Количество: {item.planned_quantity} {product?.unit}
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12} sm={4}>
                                                            <TextField
                                                                select
                                                                fullWidth
                                                                label="Склад"
                                                                value={item.warehouse_id || ''}
                                                                onChange={e => {
                                                                    const updated = [...deliveryForm.items];
                                                                    updated[idx].warehouse_id = e.target.value;
                                                                    updated[idx].rack_id = '';
                                                                    updated[idx].place_id = '';
                                                                    setDeliveryForm({...deliveryForm, items: updated});
                                                                }}
                                                                required
                                                            >
                                                                {mockWarehouses.map(w => (
                                                                    <MenuItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</MenuItem>
                                                                ))}
                                                            </TextField>
                                                        </Grid>
                                                        <Grid item xs={12} sm={4}>
                                                            <TextField
                                                                select
                                                                fullWidth
                                                                label="Стеллаж"
                                                                value={item.rack_id || ''}
                                                                onChange={e => {
                                                                    const updated = [...deliveryForm.items];
                                                                    updated[idx].rack_id = e.target.value;
                                                                    updated[idx].place_id = '';
                                                                    setDeliveryForm({...deliveryForm, items: updated});
                                                                }}
                                                                disabled={!item.warehouse_id}
                                                                required
                                                            >
                                                                {(mockRacks[item.warehouse_id] || []).map(r => (
                                                                    <MenuItem key={r.rack_id} value={r.rack_id}>{r.name}</MenuItem>
                                                                ))}
                                                            </TextField>
                                                        </Grid>
                                                        <Grid item xs={12} sm={4}>
                                                            <TextField
                                                                select
                                                                fullWidth
                                                                label="Полка (опционально)"
                                                                value={item.place_id || ''}
                                                                onChange={e => {
                                                                    const updated = [...deliveryForm.items];
                                                                    updated[idx].place_id = e.target.value;
                                                                    setDeliveryForm({...deliveryForm, items: updated});
                                                                }}
                                                                disabled={!item.rack_id}
                                                            >
                                                                <MenuItem value="">
                                                                    <em>Без полки</em>
                                                                </MenuItem>
                                                                {(mockPlaces[item.rack_id] || []).map(p => (
                                                                    <MenuItem key={p.place_id} value={p.place_id}>{p.name}</MenuItem>
                                                                ))}
                                                            </TextField>
                                                        </Grid>
                                                    </Grid>
                                                    {item.warehouse_id && item.rack_id && (
                                                        <Alert severity="success" icon={<CheckCircleIcon/>} sx={{mt: 2}}>
                                                            <Typography variant="caption">
                                                                Размещение: {mockWarehouses.find(w => w.warehouse_id === item.warehouse_id)?.name} → {mockRacks[item.warehouse_id]?.find(r => r.rack_id === item.rack_id)?.name}
                                                                {item.place_id && ` → ${mockPlaces[item.rack_id]?.find(p => p.place_id === item.place_id)?.name}`}
                                                            </Typography>
                                                        </Alert>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Отмена</Button>
                    {activeStep > 0 && <Button onClick={handleBack}>Назад</Button>}
                    {activeStep < 3 ? (
                        <Button onClick={handleNext} variant="contained"
                                disabled={activeStep === 1 && deliveryForm.items.length === 0}>
                            Далее
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} variant="contained">
                            Создать поставку
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Детали поставки</DialogTitle>
                <DialogContent>
                    {selectedDelivery && (
                        <Box>
                            <Grid container spacing={2} sx={{mb: 2}}>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Номер:</Typography>
                                    <Typography variant="body1">{selectedDelivery.delivery_number}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Дата:</Typography>
                                    <Typography
                                        variant="body1">{new Date(selectedDelivery.delivery_date).toLocaleDateString('ru-RU')}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="text.secondary">Поставщик:</Typography>
                                    <Typography
                                        variant="body1">{getSupplierName(selectedDelivery.supplier_id)}</Typography>
                                </Grid>
                            </Grid>

                            <Divider sx={{my: 2}}/>

                            <Typography variant="h6" gutterBottom>Товары</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Товар</TableCell>
                                            <TableCell>Количество</TableCell>
                                            <TableCell>Цена</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedDelivery.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{getProductName(item.product_id)}</TableCell>
                                                <TableCell>{item.planned_quantity}</TableCell>
                                                <TableCell>{item.price_per_unit || '-'}</TableCell>
                                            </TableRow>
                                        ))}
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

            <Dialog open={addSupplierOpen} onClose={() => setAddSupplierOpen(false)}>
                <DialogTitle>Добавить поставщика</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название"
                        fullWidth
                        value={newSupplier.name}
                        onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                        required
                    />
                    <TextField
                        margin="dense"
                        label="УНП"
                        fullWidth
                        value={newSupplier.inn}
                        onChange={e => setNewSupplier({ ...newSupplier, inn: e.target.value })}
                        sx={{ minWidth: 200 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddSupplierOpen(false)}>Отмена</Button>
                    <Button onClick={handleAddSupplier} variant="contained">Добавить</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={addProductOpen} onClose={() => setAddProductOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Добавить товар</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{mt: 1, mb: 2}}>
                        SKU будет сгенерирован автоматически на основе названия и категории товара
                    </Alert>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название товара"
                        fullWidth
                        value={newProduct.name}
                        onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                        required
                        helperText="Обязательное поле"
                    />
                    <TextField
                        margin="dense"
                        label="Категория"
                        fullWidth
                        value={newProduct.category}
                        onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                        helperText="Используется для генерации SKU и автоматического размещения"
                    />
                    <TextField
                        margin="dense"
                        label="Единица измерения"
                        fullWidth
                        select
                        value={newProduct.unit}
                        onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
                    >
                        <MenuItem value="шт">Штуки (шт)</MenuItem>
                        <MenuItem value="кг">Килограммы (кг)</MenuItem>
                        <MenuItem value="л">Литры (л)</MenuItem>
                        <MenuItem value="г">Граммы (г)</MenuItem>
                        <MenuItem value="мл">Миллилитры (мл)</MenuItem>
                        <MenuItem value="м">Метры (м)</MenuItem>
                        <MenuItem value="упак">Упаковки (упак)</MenuItem>
                    </TextField>
                    <TextField
                        margin="dense"
                        label="Описание"
                        fullWidth
                        multiline
                        rows={2}
                        value={newProduct.description}
                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                        placeholder="Дополнительная информация о товаре..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddProductOpen(false)}>Отмена</Button>
                    <Button onClick={handleAddProduct} variant="contained">Добавить товар</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ReceivePage;
