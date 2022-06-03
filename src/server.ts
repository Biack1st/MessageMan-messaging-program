const express = require("express");
const app = express();

app.get("/", (_req, res) => {
    res.send("yay server is running!!");
});

export = function () {
    app.listen(3000, () => {
        console.log("server started");
    });
};
