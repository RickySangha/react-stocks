import React, { useState } from "react";
import "./App.css";

const api = {
  incomeStatement:
    "https://financialmodelingprep.com/api/v3/financials/income-statement/",
  balanceSheet:
    "https://financialmodelingprep.com/api/v3/financials/balance-sheet-statement/",
  dcf: "https://financialmodelingprep.com/api/v3/company/discounted-cash-flow/",
  profile: "https://financialmodelingprep.com/api/v3/company/profile/",
  cashFlow:
    "https://financialmodelingprep.com/api/v3/financials/cash-flow-statement/",
};

const inflationRate = 3;
const discountRate = 10;

//Display numbers as currency (USD)
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function App() {
  const [ticker, setTicker] = useState("");
  const [stocks, setstocks] = useState([]);
  const [bond10y, setbond10y] = useState(2);

  //Make API request and setstocks after user hits enter on keyboard.
  function handleKey(e) {
    if (e.key === "Enter") {
      let dcfData = fetch(`${api.dcf}${ticker}`);
      let incomeData = fetch(`${api.incomeStatement}${ticker}`);
      let balanceData = fetch(`${api.balanceSheet}${ticker}`);
      let profile = fetch(`${api.profile}${ticker}`);
      let cashFlow = fetch(`${api.cashFlow}${ticker}`);

      Promise.all([dcfData, incomeData, balanceData, profile, cashFlow])
        .then((responses) => {
          return Promise.all(responses.map((response) => response.json()));
        })
        .then((data) => {
          let stock = {
            dcf: data[0],
            incomeStatement: data[1],
            balanceSheet: data[2],
            profile: data[3],
            cashFlow: data[4],
          };

          [data[3].fv, data[3].netEquityGrowthRate] = calcEquityGrowthandFV(
            stock
          );

          data[3].dcf = calcDcf(stock);

          setstocks([...stocks, stock]);
        })
        .catch((err) => {
          alert("Please enter a valid US stock ticker.");
          console.log(err);
        });
    }
  }

  //Delete stock from table
  function handleDelete(e) {
    let ticker = e.target.parentNode.firstChild.innerText;
    let newStocks = [...stocks].filter(
      (stock) => stock.profile.symbol !== ticker
    );
    setstocks(newStocks);
  }

  //Calculate 5yr average equity growth rate and fair value (Buffet method)
  function calcEquityGrowthandFV(stock) {
    let balanceFinancials = [...stock.balanceSheet.financials].slice(
      0,
      stock.balanceSheet.financials.length > 5
        ? 6
        : stock.balanceSheet.financials.length + 1
    );
    let currentEquity = parseFloat(
      balanceFinancials[0]["Total shareholders equity"]
    );
    let previousEquity = parseFloat(
      balanceFinancials[balanceFinancials.length - 1][
        "Total shareholders equity"
      ]
    );

    let netEquityGrowthRate =
      Math.pow(
        currentEquity / previousEquity,
        1 / (balanceFinancials.length - 1)
      ) - 1;

    let bv =
      currentEquity /
      stock.incomeStatement.financials[0]["Weighted Average Shs Out (Dil)"];

    let dividend1yr = parseFloat(
      stock.incomeStatement.financials[0]["Dividend per Share"]
    );

    let fv =
      bv * Math.pow(1 + netEquityGrowthRate, 10) +
      (dividend1yr * 10) / Math.pow(1 + bond10y / 100, 10);

    return [fv, (Math.round(netEquityGrowthRate * 10000) / 100).toFixed(2)];
  }

  //Calculate fair value with DCF model
  function calcDcf(stock) {
    let fcf = parseFloat(stock.cashFlow.financials[0]["Free Cash Flow"]);
    let dcf10 = 0;

    for (let i = 1; i < 11; i++) {
      dcf10 +=
        (fcf * Math.pow(1 + stock.profile.netEquityGrowthRate / 100, i)) /
        Math.pow(1 + discountRate / 100, i);
    }

    let dcfperp = fcf / (discountRate / 100 - inflationRate / 100);
    let dcfval =
      (dcf10 + dcfperp) /
      stock.incomeStatement.financials[0]["Weighted Average Shs Out (Dil)"];
    console.log(dcfval, dcfperp, dcf10);
    return dcfval;
  }

  //Map the new stocks state to a new table row
  let stockList = stocks.map((stock, i) => {
    let symbol = stock.profile.symbol;
    let currentPrice = stock.profile.profile.price;
    let eps =
      Math.round(stock.incomeStatement.financials[0]["EPS Diluted"] * 100) /
      100;
    let pe = Math.round((currentPrice / eps) * 100) / 100;
    let dcf =
      typeof stock.profile.dcf === "number"
        ? formatter.format(
            (Math.round(stock.profile.dcf * 100) / 100).toFixed(2)
          )
        : "N/A";
    let dividend = (
      (stock.incomeStatement.financials[0]["Dividend per Share"] /
        currentPrice) *
      100
    ).toFixed(2);
    let netEquityGrowth5yr = stock.profile.netEquityGrowthRate;
    let netIncomes = [
      formatter.format(
        stock.incomeStatement.financials[0]["Net Income"] / 1000000
      ),
      formatter.format(
        stock.incomeStatement.financials[1]["Net Income"] / 1000000
      ),
      formatter.format(
        stock.incomeStatement.financials[2]["Net Income"] / 1000000
      ),
    ];
    let fv = formatter.format(
      (Math.round(stock.profile.fv * 1000) / 1000).toFixed(2)
    );

    return (
      <tr key={i}>
        <td>{symbol}</td>
        <td>{formatter.format(currentPrice)}</td>
        <td>{eps}</td>
        <td>{pe}</td>
        <td>
          {netIncomes[2]}M, {netIncomes[1]}M, {netIncomes[0]}M
        </td>
        <td>{dividend}%</td>
        <td>{netEquityGrowth5yr}%</td>
        <td>{fv}</td>
        <td>{dcf}</td>
        <td className="delete" onClick={(e) => handleDelete(e)}>
          Delete
        </td>
      </tr>
    );
  });

  return (
    <div className="App">
      <h1>Intrinsic Value Calculator</h1>
      <input
        type="text"
        placeholder="Enter Ticker (eg. TSLA)"
        className="searchbarticker"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toLocaleUpperCase())}
        onKeyPress={(e) => handleKey(e)}
      />
      <input
        type="number"
        placeholder="10yr Bond Rate (eg. 5%)"
        className="searchbarbond"
        onChange={(e) => setbond10y(parseFloat(e.target.value))}
        onKeyPress={(e) => handleKey(e)}
      />
      <table>
        <tbody>
          <tr id="firstrow">
            <th>Stock</th>
            <th>Current Price</th>
            <th>EPS</th>
            <th>PE</th>
            <th>Net Income(2017, 2018, 2019)</th>
            <th>Dividend</th>
            <th>Growth (BV)</th>
            <th>Fair Value</th>
            <th>DCF Value</th>
            <th></th>
          </tr>
          {stocks.length ? stockList : null}
        </tbody>
      </table>
    </div>
  );
}

export default App;
