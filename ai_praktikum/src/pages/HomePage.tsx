import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../shared/config/routes'
import { ru } from '../shared/i18n/ru'

const menuItems = [
  { to: APP_ROUTES.logicNeuron, label: ru.modules.logicNeuron },
  { to: APP_ROUTES.parityNumbers, label: ru.modules.parityNumbers },
  { to: APP_ROUTES.lettersAbc, label: ru.modules.lettersAbc },
  { to: APP_ROUTES.lettersStyles, label: ru.modules.lettersStyles },
  { to: APP_ROUTES.logicNetwork, label: ru.modules.logicNetwork },
  { to: APP_ROUTES.medicalSingle, label: ru.modules.medicalSingle },
  { to: APP_ROUTES.medicalMulti, label: ru.modules.medicalMulti },
]

export function HomePage() {
  return (
    <section className="card">
      <h2>Выберите модуль</h2>
      <p>Каркас проекта уже готов для реализации всех сценариев из ТЗ.</p>
      <ul className="module-grid">
        {menuItems.map((item) => (
          <li key={item.to}>
            <Link className="module-link" to={item.to}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
