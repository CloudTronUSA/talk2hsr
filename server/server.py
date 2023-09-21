from flask import Flask, request, jsonify, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from threading import Thread
from RLfinetune import RLAgent
import random
import string
import json
import openai
import uuid

OPENAI_AUTHKEY = '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'
ENABLE_GPT4 = True    # enable GPT-4

app = Flask(__name__)
CORS(app)
app.wsgi_app = ProxyFix(app.wsgi_app)
limiter = Limiter(key_func=get_remote_address, app=app)
agent = RLAgent(OPENAI_AUTHKEY)   # Prompt-Based RL Finetune agent

force_g4 = []   # list of session ids that are forced to use gpt3.5
sessions = {}
'''
session_id: session {
    'prompt_id': 'prompt id',
    'history_msg': [
        {sender: 'user', message: 'message'},
        {sender: 'assistant', message: 'message'},
    ]
}
'''
prompts = {}
'''
prompt_id: prompt {
    'prompt': 'prompt text'
}
'''
tasks = {}
'''
task_id: task {
    'status': x,    # 0: failed, 1: in progress, 2: finished
    'new_prompt': 'prompt text',
    'prompt_id': 'prompt id'
}
'''

DEFAULT_PROMPT = '''Generate a response in the style of the character "SilverWolf" (银狼). She\'s efficient, direct, and has a cool and detached tone. She tends not to speak too much and doesn\'t show much interest in conversations. Balance her character traits, making her response concise and straightforward without overemphasizing sarcasm or being overly playful. Here are some example sentences to reference:\n\n银狼：…是，都是我起的名字。嗯？你本来是想问『星核猎手』？那你去问他们啊，别来占用我打游戏的时间。\n银狼：就算有也是陷阱，黑塔的收藏不可能对外展示。\n银狼：这是监控室，删库跑路一条龙，业内传统了。\n银狼：你还是过来吧，这样调查一点也不效率。\n银狼：直接把监控系统黑掉了事。\n银狼：我没有又哭又闹。'''

def generate_id():
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(4)) + '-' + \
           ''.join(random.choice(chars) for _ in range(4)) + '-' + \
           ''.join(random.choice(chars) for _ in range(2))

# Load existing sessions and prompts from file
def load_saves():
    try:
        with open('sessions.json', 'r') as f:
            sessions = json.load(f)
        with open('prompts.json', 'r') as f:
            prompts = json.load(f)
        return sessions, prompts
    except FileNotFoundError:
        return {}, {}

# Save sessions to file
def save_data(sessions=None, prompts=None):
    if sessions is not None:
        with open('sessions.json', 'w') as f:
            json.dump(sessions, f)
    if prompts is not None:
        with open('prompts.json', 'w') as f:
            json.dump(prompts, f)

# construct a prompt from a session id and message
def construct_prompt(session_id, message):
    global sessions
    prompt_id = sessions[session_id]['prompt_id']
    prompt = [{'role':'system', 'content': prompts[prompt_id]['prompt']}]
    # get history messages
    history_msg = sessions[session_id].get('history_msg', None)
    if history_msg == None:
        history_msg = []
    else:
        history_msg = history_msg[-10:]
    # regenerate or normal generate
    if message:
        history_msg.append({'role': 'user', 'content': message})
        sessions[session_id]['history_msg'].append({'role': 'user', 'content': message})
    else:   # regenerate
        history_msg.pop()   # remove the last message (from assiatant)
        sessions[session_id]['history_msg'].pop()
    prompt += history_msg
    return prompt

# use GPT-4 to generate a response to a prompt
def llm_generate(session_id, prompt, length=256, temperature=0.9, top_p=1.0, top_k=0, repetition_penalty=1.0):
    global sessions
    # handle generation and return the response
    if session_id in force_g4:
        completion = openai.ChatCompletion.create(
            model="gpt-4",
            messages=prompt
        )
    else:
        completion = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=prompt
        )
    msg = completion.choices[0].message
    sessions[session_id]['history_msg'].append(msg)
    save_data(sessions=sessions)
    return msg.get('content', '......')

# update the prompt with feedback
def update_prompt(task_id,session_id,feedback,feedback_text):
    global tasks, prompts, sessions
    if ENABLE_GPT4 == False:
        tasks[task_id]['status'] = '0'
        print(f'# RL Finetune #\nError updating prompt for session {session_id}')
        print('You must have access and enabled GPT-4 to use RL Finetune.')
    try:
        print('\n# RL Finetune #')
        if sessions[session_id]['prompt_id'] == 'DEFAULT':        
            # assign a new prompt
            prompt_id = generate_id()
            prompts[prompt_id] = {'prompt': DEFAULT_PROMPT}
            sessions[session_id]['prompt_id'] = prompt_id
            tasks[task_id]['prompt_id'] = prompt_id
            print(f'Assigned new PromptID {prompt_id} for Session {session_id}')
            save_data(sessions=sessions, prompts=prompts)
        else:
            prompt_id = sessions[session_id]['prompt_id']
            tasks[task_id]['prompt_id'] = prompt_id
        print(f'Session {session_id} requested to update prompt {prompt_id}')
        print(f'Feedback: {feedback} | {feedback_text}\n')
        # update the prompt
        agent.generator.instruction = prompts[prompt_id]['prompt']
        agent.generator.body = sessions[session_id]['history_msg']
        agent.update(feedback,feedback_text, debug_reasoning=True)
        # save new prompt
        prompts[prompt_id]['prompt'] = agent.generator.instruction
        tasks[task_id]['new_prompt'] = agent.generator.instruction
        tasks[task_id]['status'] = '2'
        save_data(prompts=prompts)
        print(f'# RL Finetune #\nPrompt {prompt_id} updated for session {session_id}\n')
        #print(f'New Prompt: {agent.generator.instruction}\n')
    except Exception as e:
        print(f'# RL Finetune #\nError updating prompt for session {session_id}')
        tasks[task_id]['status'] = '0'  # error
        print(e)
        print()

#@app.before_request
#def initialize():
#    global sessions, prompts
#    if not hasattr(g, 'loaded'):
#        g.loaded = True

# load existing sessions and prompts
sessions, prompts = load_saves()

# handle new session request
@app.route('/api/new_session', methods=['POST'])
@limiter.limit("2/minute")
def new_session():
    session_id = generate_id()
    #prompt_id = generate_id()
    prompt_id = 'DEFAULT'
    sessions[session_id] = {'prompt_id': prompt_id, 'history_msg': []}
    prompts[prompt_id] = {'prompt': DEFAULT_PROMPT}
    save_data(sessions=sessions, prompts=prompts) # Save sessions to file
    return jsonify({'session_id': session_id, 'prompt_id': prompt_id, 'prompt': prompts[prompt_id]['prompt']})

# handle generation request
@app.route('/api/gen', methods=['POST'])
@limiter.shared_limit("50/hour", scope="gen/regen")
def gen():
    global force_g4, sessions
    session_id = request.json.get('session_id')
    message = request.json.get('message')
    if session_id not in sessions:
        return jsonify({'error': 'Invalid session id'}), 400 
    
    ''' # old code
    # force gpt4
    if message.lower() == "@debug.4ceg4":
        force_g4.append(session_id)
        return jsonify({'text': 'DEBUG RULE "debug.forcegpt4" IS ENABLED. GPT-4 WILL BE USED FOR ALL RESPONSES.'})
    
    # handle generation and return the response
    constructed_prompt = construct_prompt(session_id, message)
    response = llm_generate(session_id, constructed_prompt)
    '''

    # load in information to agent
    prompt_id = sessions[session_id]['prompt_id']
    agent.generator.instruction = prompts[prompt_id]['prompt']
    agent.generator.body = sessions[session_id]['history_msg']
    # generate response
    response = agent.generate(message=message, use_gpt4=ENABLE_GPT4)
    # pull out information from agent
    sessions[session_id]['history_msg'] = agent.generator.body
    save_data(sessions=sessions)

    return jsonify({'text': response})

@app.route('/api/regen', methods=['POST'])
@limiter.shared_limit("50/hour", scope="gen/regen")
def regen():
    session_id = request.json.get('session_id')
    if session_id not in sessions:
        return jsonify({'error': 'Invalid session id'}), 400
    # handle your regeneration and return the response
    ''' # old code
    constructed_prompt = construct_prompt(session_id, None)
    response = llm_generate(session_id, constructed_prompt)
    '''

    # load in information to agent
    prompt_id = sessions[session_id]['prompt_id']
    agent.generator.instruction = prompts[prompt_id]['prompt']
    agent.generator.body = sessions[session_id]['history_msg']
    # generate response
    response = agent.regenerate(use_gpt4=ENABLE_GPT4)
    # pull out information from agent
    sessions[session_id]['history_msg'] = agent.generator.body
    save_data(sessions=sessions)

    return jsonify({'text': response})

# handle feedback request
@app.route('/api/feedback', methods=['POST'])
@limiter.limit("1/second")
def feedback():
    global tasks
    session_id = request.json.get('session_id')
    feedback = request.json.get('feedback')
    feedback_text = request.json.get('feedback_text')
    if session_id not in sessions:
        return jsonify({'error': 'Invalid session id'}), 400
    # Create a unique ID for the task
    task_id = str(uuid.uuid4())
    # Store the task with its status
    tasks[task_id] = {
        'status': 1,    # 0: failed, 1: in progress, 2: finished
        'new_prompt': '',
        'prompt_id': ''
    }
    # Start the long running task in another thread
    Thread(target=update_prompt, args=(task_id,session_id,feedback,feedback_text)).start()
    # Return the task ID to the client
    return jsonify({'task_id': task_id})

@app.route('/api/feedback_status', methods=['GET'])
def feedback_status():
    task_id = request.args.get('task_id')
    if task_id not in tasks:
        return jsonify({'error': 'Invalid task id'}), 400

    # Return the status of the task
    return jsonify(tasks[task_id])

@app.route('/api/set_promptid', methods=['POST'])
@limiter.limit("1/second")
def set_promptid():
    session_id = request.json.get('session_id')
    prompt_id = request.json.get('prompt_id')
    if session_id not in sessions:
        return jsonify({'error': 'Invalid session id'}), 400
    if prompt_id not in prompts:
        return jsonify({'error': 'Invalid prompt id'}), 400
    sessions[session_id]['prompt_id'] = prompt_id
    save_data(sessions=sessions)
    print(f'# Session PromptID Change #\nPrompt {prompt_id} set for session {session_id}\n')
    return jsonify({'prompt': prompts[prompt_id]['prompt'], 'prompt_id': prompt_id})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8008)
