import type { Context } from 'koa';

export default {
  async check(ctx: Context) {
    ctx.status = 200;
    ctx.body = { status: 'ok' };
  },
};
