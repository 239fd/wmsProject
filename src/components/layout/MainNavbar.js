import React, {useState, useEffect} from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Box,
    Menu,
    MenuItem,
    Tooltip,
    Avatar,
    FormControl,
    InputLabel,
    Select,
    Button,
    Drawer,
    List,
    ListItemButton,
    ListItemText,
    Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import {useNavigate, useLocation} from 'react-router-dom';

const roleNav = {
    Работник: [
        {key: 'receive', label: 'Прием товара', path: '/receive'},
        {key: 'ship', label: 'Отгрузка', path: '/ship'},
    ],
    Бухгалтер: [
        {key: 'inventory', label: 'Инвентаризация', path: '/inventory'},
        {key: 'revaluation', label: 'Переоценка', path: '/revaluation'},
        {key: 'writeoff', label: 'Списание', path: '/writeoff'},
    ],
    Директор: [
        {key: 'analytics', label: 'Аналитика', path: '/analytics'},
        {key: 'employees', label: 'Сотрудники', path: '/employees'},
        {key: 'organization', label: 'Организация', path: '/organization'},
    ],
};

const MainNavbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [anchorEl, setAnchorEl] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    const storedUser = (() => {
        try {
            const raw = localStorage.getItem('wms_user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    })();

    const [role, setRole] = useState(() => {
        if (storedUser?.role) {
            return storedUser.role;
        }
        return localStorage.getItem('wms_role') || 'Работник';
    });

    const isRoleEditable = !storedUser;

    useEffect(() => {
        if (!storedUser) {
            localStorage.setItem('wms_role', role);
        }
    }, [role, storedUser]);

    const handleSettingsClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSettings = () => {
        handleClose();
        navigate('/settings');
    };
    const handleLogout = () => {
        handleClose();
        localStorage.removeItem('wms_user');
        localStorage.removeItem('wms_role');
        navigate('/');
    };

    const navItems = roleNav[role] || [];

    const toggleMobile = (open) => () => {
        setMobileOpen(open);
    };

    const handleMobileNavigate = (path) => {
        setMobileOpen(false);
        navigate(path);
    };

    return (
        <>
            <AppBar position="static" elevation={1} sx={{mb: 4}} color="inherit">
                <Toolbar sx={{justifyContent: 'space-between', position: 'relative'}}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <Typography
                            variant="h6"
                            sx={{fontWeight: 700, letterSpacing: 2, cursor: 'pointer'}}
                            onClick={() => navigate('/main')}
                        >
                            WMS
                        </Typography>
                    </Box>
                    <Box sx={{
                        position: {xs: 'static', md: 'absolute'},
                        left: {md: '50%'},
                        top: 0,
                        transform: {md: 'translateX(-50%)'},
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        justifyContent: {xs: 'center', md: 'flex-start'},
                        px: {xs: 1, md: 0},
                    }}>
                        {isRoleEditable ? (
                            <FormControl size="small" sx={{minWidth: 140}}>
                                <InputLabel>Роль</InputLabel>
                                <Select value={role} label="Роль" onChange={(e) => setRole(e.target.value)}>
                                    {Object.keys(roleNav).map((r) => (
                                        <MenuItem key={r} value={r}>{r}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <Box sx={{px: 1, py: 0.5, borderRadius: 1, bgcolor: 'transparent'}}>
                                <Typography variant="body2" sx={{fontWeight: 700}}>{role}</Typography>
                            </Box>
                        )}
                        <Box sx={{display: {xs: 'none', md: 'flex'}, gap: 1}}>
                            {navItems.map((item) => (
                                <Button
                                    key={item.key}
                                    variant={location.pathname === item.path ? 'contained' : 'text'}
                                    color={location.pathname === item.path ? 'primary' : 'inherit'}
                                    onClick={() => navigate(item.path)}
                                    sx={{textTransform: 'none'}}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </Box>
                        <IconButton
                            aria-label="menu"
                            onClick={toggleMobile(true)}
                            sx={{display: {xs: 'flex', md: 'none'}}}
                            size="large"
                        >
                            <MenuIcon/>
                        </IconButton>
                    </Box>
                    <Box display="flex" alignItems="center" gap={2}>
                        <Tooltip title="Личный кабинет">
                            <IconButton onClick={() => navigate('/profile')}>
                                <Avatar sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: '#fff',
                                    color: '#111',
                                    border: '1px solid rgba(0,0,0,0.12)'
                                }}>ЛК</Avatar>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Меню настроек">
                            <IconButton onClick={handleSettingsClick}>
                                <img src={require('../../assets/icons/settings-svgrepo-com.svg').default} alt="settings"
                                     style={{width: 28, height: 28}}/>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleClose}
                            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                            transformOrigin={{vertical: 'top', horizontal: 'right'}}
                        >
                            <MenuItem onClick={handleSettings}>Настройки</MenuItem>
                            <MenuItem onClick={handleLogout} sx={{color: 'error.main'}}>Выйти</MenuItem>
                        </Menu>
                    </Box>
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={mobileOpen} onClose={toggleMobile(false)}>
                <Box sx={{width: 260}} role="presentation" onKeyDown={(e) => {
                    if (e.key === 'Escape') setMobileOpen(false);
                }}>
                    <Box sx={{p: 2}}>
                        {isRoleEditable ? (
                            <FormControl fullWidth size="small">
                                <InputLabel>Роль</InputLabel>
                                <Select value={role} label="Роль" onChange={(e) => setRole(e.target.value)}>
                                    {Object.keys(roleNav).map((r) => (
                                        <MenuItem key={r} value={r}>{r}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <Box sx={{px: 2, py: 1, borderRadius: 1, bgcolor: 'action.hover', mb: 2}}>
                                <Typography variant="body2" sx={{fontWeight: 700}}>{role}</Typography>
                            </Box>
                        )}
                    </Box>
                    <Divider/>
                    <List>
                        {navItems.map((item) => (
                            <ListItemButton
                                key={item.key}
                                selected={location.pathname === item.path}
                                onClick={() => handleMobileNavigate(item.path)}
                            >
                                <ListItemText primary={item.label}/>
                            </ListItemButton>
                        ))}
                    </List>
                </Box>
            </Drawer>
        </>
    );
};

export default MainNavbar;
