import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import {ThemeProvider, CssBaseline} from '@mui/material';
import theme from './config/theme';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import RoleSelectPage from './pages/RoleSelectPage';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import ReceivePage from './pages/ReceivePage';
import ShipPage from './pages/ShipPage';
import InventoryPage from './pages/InventoryPage';
import RevaluationPage from './pages/RevaluationPage';
import WriteoffPage from './pages/WriteoffPage';
import AnalyticsPage from './pages/AnalyticsPage';
import EmployeesPage from './pages/EmployeesPage';
import OrganizationPage from './pages/OrganizationPage';
import MainLayout from './components/layout/MainLayout';
import GuestLayout from './components/layout/GuestLayout';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <BrowserRouter>
                <Routes>
                    <Route element={<GuestLayout/>}>
                        <Route path="/" element={<HomePage/>}/>
                        <Route path="/register" element={<RegisterPage/>}/>
                        <Route path="/role" element={<RoleSelectPage/>}/>
                        <Route path="/login" element={<LoginPage/>}/>
                    </Route>
                    <Route element={<MainLayout />}>
                        <Route path="/main" element={<MainPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/receive" element={<ReceivePage />} />
                        <Route path="/ship" element={<ShipPage />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/revaluation" element={<RevaluationPage />} />
                        <Route path="/writeoff" element={<WriteoffPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/employees" element={<EmployeesPage />} />
                        <Route path="/organization" element={<OrganizationPage />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    </React.StrictMode>
);

