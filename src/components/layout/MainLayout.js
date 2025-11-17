import React from 'react';
import MainNavbar from './MainNavbar';
import { Container } from '@mui/material';
import { Outlet } from 'react-router-dom';

const MainLayout = () => (
  <>
    <MainNavbar />
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Outlet />
    </Container>
  </>
);

export default MainLayout;
