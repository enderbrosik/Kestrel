import './styles/main.css';
import { mountApp } from './app';
import { createThemeManager } from './themes';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

// Create the theme manager first so colors are applied before anything renders.
mountApp(root, createThemeManager());
