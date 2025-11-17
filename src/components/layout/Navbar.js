import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  return (
    <AppBar position="static" color="inherit" elevation={1} sx={{ mb: 4, bgcolor: '#ffffff', color: '#111' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 2, cursor: 'pointer', color: '#111' }} onClick={() => navigate('/')}>WMS</Typography>
        <Box>
          <Button sx={{ mr: 2 }} variant="contained" color="primary" onClick={() => navigate('/login')}>Вход</Button>
          <Button sx={{}} variant="outlined" color="primary" onClick={() => navigate('/register')}>Регистрация</Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
