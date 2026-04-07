interface PageHeroProps {
  title: string
  task: string
}

export function PageHero({ title, task }: PageHeroProps) {
  return (
    <section className="hero-card">
      <p className="hero-label">Задание</p>
      <h1 className="hero-title">{title}</h1>
      <p className="hero-task">{task}</p>
    </section>
  )
}
