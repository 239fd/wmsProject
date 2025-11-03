# Быстрая инструкция для фронтенда - OAuth интеграция

## 1. Создайте компонент AuthCallback.jsx

Этот компонент обрабатывает успешную OAuth авторизацию существующего пользователя.

```jsx
// src/components/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      // Сохраняем токены в localStorage
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      
      console.log('✅ OAuth авторизация успешна!');
      
      // Редиректим на главную страницу
      navigate('/main');
    } else {
      console.error('❌ Токены не получены');
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column' 
    }}>
      <h2>Завершение авторизации...</h2>
      <p>Пожалуйста, подождите</p>
    </div>
  );
};

export default AuthCallback;
```

## 2. Добавьте кнопки OAuth на страницах Login и Register

### На странице Login:

```jsx
// Добавьте эти кнопки в ваш компонент Login
<div className="oauth-buttons" style={{ marginTop: '20px' }}>
  <button 
    type="button"
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/yandex?type=login'}
    style={{
      width: '100%',
      padding: '12px',
      marginBottom: '10px',
      backgroundColor: '#ff0000',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}
  >
    🔴 Войти через Яндекс
  </button>
  
  <button 
    type="button"
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/google?type=login'}
    style={{
      width: '100%',
      padding: '12px',
      backgroundColor: '#4285f4',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}
  >
    🔵 Войти через Google
  </button>
</div>
```

### На странице Register:

```jsx
// Добавьте эти кнопки в ваш компонент Register
<div className="oauth-buttons" style={{ marginTop: '20px' }}>
  <button 
    type="button"
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/yandex?type=register'}
    style={{
      width: '100%',
      padding: '12px',
      marginBottom: '10px',
      backgroundColor: '#ff0000',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}
  >
    🔴 Зарегистрироваться через Яндекс
  </button>
  
  <button 
    type="button"
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/google?type=register'}
    style={{
      width: '100%',
      padding: '12px',
      backgroundColor: '#4285f4',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}
  >
    🔵 Зарегистрироваться через Google
  </button>
</div>
```

## 3. Добавьте роут в App.jsx

```jsx
import AuthCallback from './components/AuthCallback';

// В секции <Routes>
<Route path="/auth/callback" element={<AuthCallback />} />
```

## Как это работает:

1. **Пользователь нажимает кнопку OAuth** → редиректится на бэкенд
2. **Бэкенд редиректит** на Яндекс/Google
3. **После авторизации** провайдер возвращает на бэкенд
4. **Бэкенд обрабатывает** и редиректит на `/auth/callback?access_token=XXX&refresh_token=YYY`
5. **AuthCallback компонент:**
   - Извлекает токены из URL
   - Сохраняет в localStorage
   - Редиректит на `/main`

## Проверка работы:

1. Откройте DevTools (F12) → вкладка Console
2. Нажмите "Войти через Яндекс/Google"
3. После авторизации в консоли должно появиться: `✅ OAuth авторизация успешна!`
4. Вы должны оказаться на странице `/main`
5. Проверьте localStorage - там должны быть `access_token` и `refresh_token`

## Важно:

- Замените `http://localhost:7777` на ваш адрес бэкенда если он другой
- Замените `/main` на вашу главную страницу после логина если она называется иначе
- Стили кнопок можно изменить под ваш дизайн

## Troubleshooting:

**Проблема:** "No routes matched location /auth/callback"  
**Решение:** Убедитесь что добавили `<Route path="/auth/callback" element={<AuthCallback />} />` в ваш роутинг

**Проблема:** Токены не сохраняются  
**Решение:** Проверьте консоль браузера на наличие ошибок, убедитесь что токены приходят в URL параметрах

**Проблема:** Редирект не работает  
**Решение:** Проверьте что у вас правильно настроен `useNavigate()` из `react-router-dom`

