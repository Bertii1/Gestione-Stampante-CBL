from flask import Flask, request, render_template,  url_for
import telnetlib

tn = telnetlib.Telnet("127.0.0.1", 23)
app = Flask(__name__)


app.route("/",methods=["GET"])
app.route("/app",methods=["GET"])
def main():
  return render_template("login.html")

app.route("/login", methods =["POST"])
def login():
  json = request.get_json()
  