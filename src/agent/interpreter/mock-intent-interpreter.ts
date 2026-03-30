import type { UserGoal } from '../protocol/agent-protocol';

export interface IntentInterpreter {
  interpret(input: string): UserGoal;
}

export class MockIntentInterpreter implements IntentInterpreter {
  interpret(input: string): UserGoal {
    const normalized = input.trim();
    const lower = normalized.toLowerCase();

    if (!normalized) {
      return { rawInput: input, intent: 'UNKNOWN', target: 'LATEST_MATCH' };
    }

    if (/(权益|会员|额度|付费|购买|解锁|订阅|pay|payment|subscribe|subscription|quota|entitlement)/i.test(normalized)) {
      return { rawInput: input, intent: 'ENTITLEMENT_VIEW', target: 'LATEST_MATCH' };
    }

    if (/(上传|视频|片段|回放|这波|团战|打不过|不该继续追|细节诊断|clip|video|vod|fight|teamfight|skirmish)/i.test(normalized)) {
      return { rawInput: input, intent: 'CLIP_REVIEW', target: 'LATEST_MATCH' };
    }

    if (/(追问|问一下|再问|细问|请拆解|先改|这局.*(为什么|怎么|哪里)|中期.*为什么|why|how|what should i fix|what went wrong|mistake|mistakes)/i.test(normalized)) {
      return { rawInput: input, intent: 'AI_FOLLOWUP', target: 'LATEST_MATCH' };
    }

    if (/(深度|深挖|详细复盘|进阶复盘|deep review|advanced review|detailed review)/i.test(normalized)) {
      return { rawInput: input, intent: 'DEEP_REVIEW', target: 'LATEST_MATCH' };
    }

    if (/(复盘|对局|分析|回顾|review|analyze|analysis|match|game)/i.test(normalized)) {
      return { rawInput: input, intent: 'BASIC_REVIEW', target: 'LATEST_MATCH' };
    }

    if (/[?？]/.test(normalized) || /(lol|league of legends|英雄联盟)/i.test(normalized) || /[a-z]/i.test(lower) || /[\u4e00-\u9fa5]/.test(normalized)) {
      return { rawInput: input, intent: 'BASIC_REVIEW', target: 'LATEST_MATCH' };
    }

    return { rawInput: input, intent: 'UNKNOWN', target: 'LATEST_MATCH' };
  }
}

