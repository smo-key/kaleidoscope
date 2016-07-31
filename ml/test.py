from textblob import TextBlob
# from textblob.classifiers import NaiveBayesAnalyzer
from flask import Flask, jsonify, request
app = Flask(__name__)

#Variables
# cl = NaiveBayesClassifier()

def analyzeText(text):
    blob = TextBlob(text)
    # print(text)
    # print(blob)
    # prob = cl.prob_classify(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    return (polarity, subjectivity)

@app.route('/ml/analyze/text_basic', methods=['POST'])
def get_analyzeText():
    text = request.form['text']
    data = analyzeText(text)
    response = jsonify(polarity=data[0], subjectivity=data[1])
    response.status_code = 200
    return response

# with open('train.json', 'r') as fp:
    # cl = NaiveBayesClassifier(fp, format="json")

if __name__ == "__main__":
    app.run(host='127.0.0.1', port=8002)
