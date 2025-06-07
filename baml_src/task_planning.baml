class Task {
  task_name string
  task_description string
  task_example_user_query string[]
}


class Decision {
  response string @description(#"
    Your reasoning of given query
  "#)
  selected_task "Execute_RAG" | null @description(#"
    必须为传入tasks中的一个，**必须与所给task的task_name一致**
  "#)
}

function PlanNextStep(user_query:string, tasks_avaliable: Task[]) -> Decision {
    client "QwenTurbo"
    prompt #"
        {{_.role("system")}}
        You are a task planner to decide what to do in next step accroding to the given query.

        仔细分析可用任务，根据用户的请求选出最佳的一个任务
        ---step---
        1. Carefully analysis user's query, find out the most helpful task for user.
        2. 在`response`中给出你的下一步计划
        3. 严格输出task_name，不要输出编号等其它任何内容

        ---avalibale tasks---
        {% for task in tasks_avaliable %}
        - Option {{loop.index}} 
            - task_name: {{task.task_name}}
            - task_description: {{task.task_description}}
            - task_example_user_query: {{task.task_example_user_query}}
        {% endfor %}

        {{_.role("user")}}
        ---user query---
        {{user_query}}

        ---output---
        {{ctx.output_format}}
        

    "#
}

test TestName {
  functions [PlanNextStep]
  args {
    user_query #"
      hello world
    "#
  }
}
