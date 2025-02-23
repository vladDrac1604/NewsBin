const mailId = process.env.MAILID;
const mailPassword = process.env.MAILPASSWORD;
const invalidLoginErrMessage = "Please enter valid credentials.";

function configureDisplayContent(articles) {
    for(let i = 0; i < articles.length; i++) {
        if(articles[i].content.length >= 475) {
            articles[i].content = articles[i].content.slice(0, 475) + "........";
        }
    }
    return articles;
}

function getCurrentDate() {
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0'); 
    let yyyy = today.getFullYear();
    return (dd + '/' + mm + '/' + yyyy);
}

function getRandomArticle(articles, totalRecords) {
    let random = Math.floor(Math.random() * (totalRecords-1));
    while(articles[random] == undefined || articles[random].urlToImage == undefined) {
        random = Math.floor(Math.random() * (totalRecords-1));
    }
    return articles[random];
}

function generateFourDigitOtp() {
    let otp = Math.floor(1000 + Math.random() * 9000);
    return otp;
}

module.exports.configureDisplayContent = configureDisplayContent;
module.exports.getCurrentDate = getCurrentDate;
module.exports.getRandomArticle = getRandomArticle;
module.exports.generateFourDigitOtp = generateFourDigitOtp;
module.exports.mailId = mailId;
module.exports.mailPassword= mailPassword;
module.exports.invalidLoginErrMessage = invalidLoginErrMessage;