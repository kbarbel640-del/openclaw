from openai import OpenAI

# 直接在初始化时添加自定义headers
client = OpenAI(
    api_key="sk-9g4ZM1r4j0n6avy665MrizqzxS1RGhuOW6rvKCEgrVZRdOTa",
    base_url="http://model.mify.ai.srv/v1",
    default_headers={
        "X-Model-Provider-Id": "azure_openai"
        # 若为gemini，填写为vertex_ai
    }
)

# 非流式调用
response = client.chat.completions.create(
    model="gpt-5.1",
    # 如需gemini，可换为gemini-3-pro-preview-pt-ai-train 、 gemini-3-pro-preview-pt
    messages=[
        {"role": "user", "content": "小米是什么时间创立的？"}
    ],
    stream=False
)
print(response.choices[0].message.content)

# # 流式调用
# stream_response = client.chat.completions.create(
#     model="gpt-4o",
#     messages=[
#         {"role": "user", "content": "小米是什么时间创立的？"}
#     ],
#     stream=True
# )

# for chunk in stream_response :
#     if chunk.choices[0].delta.content is not None:
#         print(chunk.choices[0].delta.content, end="")

