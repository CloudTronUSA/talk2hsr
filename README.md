## Talk2HSR: Talk to Characters in Honkai: Star Rail
A little webpage that look almost the same as the "Message" interface in the game. Powered by GPT-4, allows you to talk whatever you want with the characters. 

Currently supported character(s):

 1. Silver Wolf

You may add character you like with a little editing to the code.

**Install & Usage**

 1. You need to have Python in order to run the backend server. Recommend Python 3.10+ or it may cause unexpected errors.
 2. Install Flask, Flask-Limiter, Flask-Cors, OpenAI with pip:
 `pip3 install flask flask-limiter flask-cors openai`
 3. Edit *server.py*, find the line that says `OPENAI_AUTHKEY = 'xxxxx'`, replace everything in the quotation mark with your OpenAi API Key. If you dont have access to GPT-4 model, you must also set `ENABLE_GPT4` to **False\***.
 4. Open the root directory of the project in terminal, run
 `python3 server.py` to start the backend server.
 5. Open ***index.html*** in your browser. You should see a green 10-letter Session ID on the top-right of the webpage. That means it is able to connect to the backend server and ready to receive message from you.

*\* Automatic prompt fine-tuning based on feedback will not work when `ENABLE_GPT4` is set to false. To modify the prompt when automatic fine-tuning is disabled, find `DEFAULT_PROMPT = 'xxxxx'` in server.py and edit the prompt in quotation mark as you want.*