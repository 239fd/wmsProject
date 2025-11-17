import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Divider, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/main');
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh" bgcolor="background.default">
      <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, minWidth: 340, maxWidth: 400, width: '100%' }}>
        <Typography variant="h5" color="text.primary" fontWeight={700} mb={2} align="center">
          Вход в систему
        </Typography>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField label="Email" name="email" value={form.email} onChange={handleChange} fullWidth required autoFocus />
            <TextField label="Пароль" name="password" type="password" value={form.password} onChange={handleChange} fullWidth required />
            <Button type="submit" variant="contained" color="primary" size="large" fullWidth sx={{ mt: 1 }}>
              Войти
            </Button>
          </Stack>
        </form>
        <Divider sx={{ my: 3 }}>или</Divider>
        <Stack spacing={1}>
          <Button variant="outlined" startIcon={<img src={require('../assets/icons/icons8-google.svg').default} alt="Google" style={{width: 24, height: 24}} />} fullWidth>
            Войти через Google
          </Button>
          <Button variant="outlined" startIcon={<img src={require('../assets/icons/idjTYqBahg_1760536075578.png')} alt="Yandex" style={{width: 24, height: 24}} />} fullWidth>
            Войти через Яндекс
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default LoginPage;
