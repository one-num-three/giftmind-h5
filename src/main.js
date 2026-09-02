import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setupFlexible } from './utils/flexible'
import { registerBase } from './components/base'

import './styles/reset.css'
import './styles/tokens.css'
import './styles/global.css'

setupFlexible()

const app = createApp(App)
app.use(createPinia())
app.use(router)
registerBase(app)
app.mount('#app')
