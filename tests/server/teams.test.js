import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeSession, signup, startServer } from './helpers.js'

let srv
beforeAll(async () => (srv = await startServer()))
afterAll(() => srv.close())

describe('teams', () => {
  it('hides team numbers until 3 people have joined, then shows only totals', async () => {
    const owner = await signup(srv.url, 'Olive')
    const created = await owner.post('/api/teams', { name: 'Platform' })
    expect(created.status).toBe(201)
    const { id, inviteCode } = created.data.team

    const m1 = await signup(srv.url, 'Max')
    expect((await m1.post('/api/teams/join', { code: inviteCode.toLowerCase() })).status).toBe(201)
    expect((await m1.post('/api/teams/join', { code: inviteCode })).status).toBe(409)
    await owner.post('/api/sessions', makeSession({ minutes: 25 }))
    await m1.post('/api/sessions', makeSession({ minutes: 50 }))

    let view = await m1.get(`/api/teams/${id}`)
    expect(view.data.stats).toBeNull()
    expect(view.data.team.inviteCode).toBeNull()

    const m2 = await signup(srv.url, 'Mia')
    await m2.post('/api/teams/join', { code: inviteCode })
    view = await m2.get(`/api/teams/${id}`)
    expect(view.data.members).toHaveLength(3)
    expect(view.data.stats.minutes).toBe(75)
    expect(view.data.stats.activeMembers).toBe(2)
    // No per person figures anywhere in the reply.
    expect(JSON.stringify(view.data.members)).not.toMatch(/minutes/)
  })

  it('lets only the owner manage, and never lets outsiders see the team', async () => {
    const owner = await signup(srv.url, 'Boss')
    const { data } = await owner.post('/api/teams', { name: 'Design' })
    const member = await signup(srv.url, 'Worker')
    const outsider = await signup(srv.url, 'Stranger')
    await member.post('/api/teams/join', { code: data.team.inviteCode })
    const memberId = (await member.get('/api/auth/me')).data.user.id

    expect((await outsider.get(`/api/teams/${data.team.id}`)).status).toBe(404)
    expect((await member.post(`/api/teams/${data.team.id}/invite`)).status).toBe(403)
    expect((await member.del(`/api/teams/${data.team.id}`)).status).toBe(403)

    const rotated = await owner.post(`/api/teams/${data.team.id}/invite`)
    expect(rotated.data.inviteCode).not.toBe(data.team.inviteCode)
    expect((await outsider.post('/api/teams/join', { code: data.team.inviteCode })).status).toBe(404)

    expect((await owner.post(`/api/teams/${data.team.id}/leave`)).status).toBe(400)
    expect((await owner.post(`/api/teams/${data.team.id}/transfer`, { userId: memberId })).status).toBe(200)
    expect((await member.get(`/api/teams/${data.team.id}`)).data.team.role).toBe('owner')
    expect((await owner.post(`/api/teams/${data.team.id}/leave`)).status).toBe(200)
    expect((await member.del(`/api/teams/${data.team.id}`)).status).toBe(200)
    expect((await member.get('/api/teams')).data.teams).toHaveLength(0)
  })

  it('lets the owner remove a member', async () => {
    const owner = await signup(srv.url, 'Kim')
    const { data } = await owner.post('/api/teams', { name: 'Ops' })
    const m = await signup(srv.url, 'Lee')
    await m.post('/api/teams/join', { code: data.team.inviteCode })
    const leeId = (await m.get('/api/auth/me')).data.user.id
    expect((await owner.del(`/api/teams/${data.team.id}/members/${leeId}`)).status).toBe(200)
    expect((await m.get(`/api/teams/${data.team.id}`)).status).toBe(404)
  })
})
