import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

function setRootFontSize() {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 375
  document.documentElement.style.fontSize = `${Math.min(viewportWidth, 375) / 10}px`
}

setRootFontSize()
window.addEventListener('resize', setRootFontSize)

createApp(App).mount('#app')
