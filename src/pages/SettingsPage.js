import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button, Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';

const sessions = [
  { id: 1, device: 'Chrome', ip: '192.168.1.10', date: '2025-10-16', time: '14:23', location: 'Минск, Беларусь', active: true },
  { id: 2, device: 'Safari', ip: '192.168.1.11', date: '2025-10-15', time: '09:10', location: 'Барановичи, Беларусь', active: false },
  { id: 3, device: 'Edge', ip: '192.168.1.12', date: '2025-10-10', time: '18:45', location: 'Гродно, Беларусь', active: false },
  { id: 4, device: 'Firefox', ip: '192.168.1.13', date: '2025-10-09', time: '12:30', location: 'Брест, Беларусь', active: false },
];

const SettingsPage = () => {
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(10);
  const [deleteEnabled, setDeleteEnabled] = useState(false);

  useEffect(() => {
    let timer;
    if (openDelete && deleteTimer > 0) {
      timer = setTimeout(() => setDeleteTimer(deleteTimer - 1), 1000);
    } else if (openDelete && deleteTimer === 0) {
      setDeleteEnabled(true);
    }
    return () => clearTimeout(timer);
  }, [openDelete, deleteTimer]);

  const handleTerminate = (id, isActive) => {
    if (isActive) {
      alert('Выход из аккаунта (заглушка)');
    } else {
      alert(`Сессия ${id} завершена (заглушка)`);
    }
  };
  const handleDeleteAccount = () => {
    setOpenDelete(true);
    setDeleteTimer(10);
    setDeleteEnabled(false);
  };
  const handleDeleteConfirm = () => {
    setOpenDelete(false);
    alert('Аккаунт удалён (заглушка)');
  };
  const handleDeleteCancel = () => {
    setOpenDelete(false);
  };

  return (
    <Box maxWidth={600} mx="auto" mt={4}>
      <Paper sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          Активные сессии
        </Typography>
        <List>
          {sessions.map((session) => (
            <ListItem key={session.id} sx={{ bgcolor: session.active ? 'primary.light' : 'inherit', borderRadius: 2, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <ListItemText
                primary={`${session.device} — ${session.ip}`}
                secondary={`Дата: ${session.date} ${session.time} | ${session.location}${session.active ? ' (текущая)' : ''}`}
              />
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => handleTerminate(session.id, session.active)}
              >
                Завершить
              </Button>
            </ListItem>
          ))}
        </List>
        <Stack alignItems="center" mt={4}>
          <Button variant="outlined" color="error" onClick={handleDeleteAccount}>
            Удалить аккаунт
          </Button>
        </Stack>
      </Paper>
      <Dialog open={openDelete} onClose={handleDeleteCancel}>
        <DialogTitle>Удаление аккаунта</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить аккаунт? <br />
            <b>Восстановить аккаунт будет невозможно.</b>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary" autoFocus>
            Отмена
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={!deleteEnabled}>
            {deleteEnabled ? 'Удалить' : `Удалить (${deleteTimer})`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage;
