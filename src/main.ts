import profiler from 'screeps-profiler'

profiler.enable()

export const loop = () => {
  profiler.wrap(() => {
    console.log(Game.time)
  })
}