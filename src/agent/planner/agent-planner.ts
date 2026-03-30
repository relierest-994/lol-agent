import { MockIntentInterpreter } from '../interpreter/mock-intent-interpreter';
import { MockTaskPlanner } from './mock-task-planner';
import type { AgentPlan, UserGoalIntent } from '../protocol/agent-protocol';

export type AgentIntent = UserGoalIntent;
export type AgentPlanStep = AgentPlan['steps'][number];
export type { AgentPlan };

export class AgentPlanner {
  private readonly interpreter = new MockIntentInterpreter();
  private readonly planner = new MockTaskPlanner();

  createPlan(userInput: string): AgentPlan {
    const goal = this.interpreter.interpret(userInput);
    return this.planner.plan(goal);
  }
}
