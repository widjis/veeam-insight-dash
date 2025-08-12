import requests
import time
import json
import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use the non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(filename='token_logs.log', level=logging.INFO,
                    format='%(asctime)s:%(levelname)s:%(message)s')

# Path to the file where tokens will be stored
TOKEN_FILE_PATH = 'tokens.json'

# API endpoints
global url
url = "https://10.60.10.128:9419/api/oauth2/token"
BASE_URL = "https://10.60.10.128:9419/api/v1/"

# Global variables to store tokens
access_token = None
refresh_token = None
token_expiry = None

def save_tokens():
    with open(TOKEN_FILE_PATH, 'w') as f:
        json.dump({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_expiry': token_expiry
        }, f)

def load_tokens():
    global access_token, refresh_token, token_expiry
    if os.path.exists(TOKEN_FILE_PATH):
        with open(TOKEN_FILE_PATH, 'r') as f:
            data = json.load(f)
            access_token = data.get('access_token')
            refresh_token = data.get('refresh_token')
            token_expiry = data.get('token_expiry')
            if token_expiry:
                token_expiry = float(token_expiry)

def delete_tokens():
    if os.path.exists(TOKEN_FILE_PATH):
        os.remove(TOKEN_FILE_PATH)

def log_token_expiry():
    if token_expiry:
        expiry_date = datetime.fromtimestamp(token_expiry).strftime('%Y-%m-%d %H:%M:%S')
        logging.info(f"Token expires at: {expiry_date}")
        print(f"Token expires at: {expiry_date}")

def get_access_token():
    global access_token, refresh_token, token_expiry
    headers = {
        "accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "x-api-version": "1.1-rev1"
    }
    payload = {
        "grant_type": "password",
        "username": "admin.it",
        "password": "IInd0n3s1@Merdeka!"  # Replace with your actual password
    }
    response = requests.post(url, headers=headers, data=payload, verify=False)
    if response.status_code == 200:
        data = response.json()
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        token_expiry = time.time() + data.get("expires_in", 3600)
        save_tokens()
        log_token_expiry()
        return access_token
    else:
        logging.error(
            f"Failed to obtain access token. Status Code: {response.status_code}, Response: {response.text}")
        print("Failed to obtain access token")
        print("Status Code:", response.status_code)
        print("Response:", response.text)
        return None

def make_authenticated_request(api_url):
    global access_token, token_expiry
    if access_token is None or time.time() > token_expiry:
        get_access_token()
    if access_token:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "accept": "application/json",
            "x-api-version": "1.1-rev1"
        }
        response = requests.get(api_url, headers=headers, verify=False)
        if response.status_code == 200:
            return response.json()
        else:
            logging.error(
                f"Failed to make authenticated request. Status Code: {response.status_code}, Response: {response.text}")
            print("Failed to make authenticated request")
            print("Status Code:", response.status_code)
            print("Response:", response.text)
    else:
        logging.error("Unable to obtain a valid access token")
        print("Unable to obtain a valid access token")
    return None

def combine_results(job_states, repositories_states):
    jobs_df = pd.DataFrame(job_states['data'])
    repos_df = pd.DataFrame(repositories_states['data'])
    return pd.concat([jobs_df, repos_df], axis=1)

def plot_job_states_pie_chart(job_states):
    fig, ax = plt.subplots(figsize=(7, 7))
    statuses = [job['lastResult'] for job in job_states['data']]
    counts = pd.Series(statuses).value_counts()
    counts.plot.pie(
        autopct='%1.1f%%', startangle=140, ax=ax,
        title="Veeam Backup Job States Percentage",
        colors=sns.color_palette("pastel"), wedgeprops=dict(edgecolor='w')
    )
    ax.set_ylabel('')
    plt.savefig('job_states_pie_chart.png')
    plt.close(fig)

def plot_repository_info_bar_chart(repositories_states):
    fig, ax = plt.subplots(figsize=(14, 7))
    data = []
    for repo in repositories_states['data']:
        cap = repo.get('capacityGB', 0)
        used = repo.get('usedSpaceGB', 0)
        data.append({
            'Repo Name': repo.get('name', ''),
            'Total Capacity (GB)': cap,
            'Used Space (GB)': used
        })
    df = pd.DataFrame(data)
    df.plot(
        kind='barh', x='Repo Name',
        y=['Total Capacity (GB)', 'Used Space (GB)'],
        ax=ax, title="Storage Information",
        color=sns.color_palette("viridis", n_colors=2)
    )
    for container in ax.containers:
        for rect in container:
            width = rect.get_width()
            ax.text(
                width / 2, rect.get_y() + rect.get_height() / 2,
                f'{int(width)}GB', ha='center', va='center'
            )
    ax.set_xlabel('GB')
    plt.savefig('repository_info_bar_chart.png')
    plt.close(fig)

def get_failed_jobs(job_states):
    failed = []
    now = datetime.now().astimezone()
    for job in job_states['data']:
        try:
            last_run = datetime.fromisoformat(job.get('lastRun'))
        except Exception:
            continue
        if job.get('lastResult') != 'Success' and (now - timedelta(days=1) <= last_run <= now + timedelta(days=1)):
            failed.append(job)
    return failed

def generate_report_text(job_states, repositories_states):
    # Job summary
    total = len(job_states['data'])
    counts = pd.Series([j['lastResult'] for j in job_states['data']]).value_counts()
    failed_list = get_failed_jobs(job_states)
    failed_count = len(failed_list)
    summary = "\n".join([f"{s}: {c}" for s, c in counts.items()])

    # Repository info with guard against zero-capacity
    entries = []
    for repo in repositories_states['data']:
        cap = repo.get('capacityGB', 0)
        used = repo.get('usedSpaceGB', 0)
        total_tb = cap / 1024 if cap else 0
        used_tb = used / 1024 if cap else 0
        pct = (used / cap * 100) if cap else 0
        entries.append(
            f"- Storage Name: {repo.get('name', '')}\n"
            f"  Path: {repo.get('path', '')}\n"
            f"  Total Capacity: {total_tb:.2f}TB\n"
            f"  Used Space: {used_tb:.2f}TB ({pct:.2f}%)"
        )
    repo_info = "\n\n".join(entries)

    text1 = f"*Veeam Backup Daily Report as {time.strftime('%Y-%m-%d')}*\n"
    text1 += f"\n*Total Jobs:* {total}\n*Job Status Summary:*\n{summary}\n*Failed Jobs:* {failed_count}"
    if failed_count:
        details = "\n\n".join([
            f"- Job Name: {j['name']}\n  Message: {j.get('message', 'No details available')}"
            for j in failed_list
        ])
        text1 += f"\n\n*Failed Jobs Details:*\n{details}"

    text2 = f"*Repository Information:*\n{repo_info}"
    return text1, text2

def send_media_group(chatid, message, file_path):
    url_api = 'http://10.60.10.59:8192/send-group-message'
    with open(file_path, 'rb') as f:
        files = {'image': (file_path, f.read(), 'image/png')}
    data = {'id': chatid, 'message': message}
    res = requests.post(url_api, files=files, data=data)
    if res.status_code == 200:
        logging.info('Media message sent successfully!')
    else:
        logging.error(f'Error sending media message: {res.text}')

def send_group_message(chatid, message):
    url_api = 'http://10.60.10.59:8192/send-group-message'
    res = requests.post(url_api, data={'id': chatid, 'message': message})
    if res.status_code == 200:
        logging.info('Group message sent successfully!')
    else:
        logging.error(f'Error sending group message: {res.text}')

def send_daily_report(job_states, repositories_states):
    chat_id = '120363123402010871@g.us'
    #chat_id = '120363193119024819@g.us' #MTI Alert
    text1, text2 = generate_report_text(job_states, repositories_states)
    send_group_message(chat_id, f"*Team, Here is ICT Daily Report as {time.strftime('%Y-%m-%d')}*")
    send_media_group(chat_id, text1, 'job_states_pie_chart.png')
    send_media_group(chat_id, text2, 'repository_info_bar_chart.png')

if __name__ == '__main__':
    load_tokens()
    job_states = make_authenticated_request(BASE_URL + "jobs/states")
    repos_states = make_authenticated_request(BASE_URL + "backupInfrastructure/repositories/states")
    if repos_states:
        for r in repos_states.get('data', []):
            try:
                r['usedSpaceGB'] = r.get('capacityGB', 0) - r.get('freeGB', 0)
            except Exception:
                r['usedSpaceGB'] = r.get('usedSpaceGB', 0)
    if job_states and repos_states:
        plot_job_states_pie_chart(job_states)
        plot_repository_info_bar_chart(repos_states)
        send_daily_report(job_states, repos_states)
    else:
        logging.error("Failed to fetch data from one or more endpoints")
