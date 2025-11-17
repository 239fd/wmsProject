import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';

const MAX_WIDTH = 1440;

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('wms_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const formatName = (user) => {
  if (!user) return 'Гость';
  if (user.firstName) return user.firstName;
  if (user.name) return String(user.name).split(' ')[0];
  return 'Гость';
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  return 'Добрый вечер';
};

const MainPage = () => {
  const [user, setUser] = useState(getStoredUser());
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const t = setInterval(() => setGreeting(getGreeting()), 60 * 1000);
    const onStorage = (e) => {
      if (e.key === 'wms_user') {
        setUser(getStoredUser());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(t);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const displayName = formatName(user);

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.default', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: MAX_WIDTH, px: { xs: 2, md: 6 }, my: 6 }}>
        <Paper elevation={2} sx={{ background: '#fff', borderRadius: 4, p: { xs: 3, md: 6 }, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.04)', width: '100%' }}>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2, textAlign: 'center' }}>
            {greeting}, {displayName}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}>
            Добро пожаловать в WMS!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, textAlign: 'center' }}>
            Здесь вы можете управлять всеми складскими процессами: приёмкой, отгрузкой, перемещениями, инвентаризацией и списанием товаров. Используйте меню для перехода к нужным разделам. Желаем продуктивной работы!
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default MainPage;
