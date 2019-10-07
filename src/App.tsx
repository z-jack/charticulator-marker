import { renderChartToLocalString } from 'charticulator/dist/scripts/app/views/canvas/chart_display'
import { ChartStateManager } from 'charticulator/dist/scripts/core/prototypes/state'
import { Button, Upload, Icon, Switch, InputNumber } from 'antd'
import csv from 'csvtojson'
import React, { useEffect } from 'react'
import ace from 'brace'
import * as vega from './vega'
import './App.css'


const { JsonEditor } = require('jsoneditor-react')
const { Dragger } = Upload;

const App: React.FC = () => {
  const [json, _setJson] = React.useState<object>({})
  const [mode, setMode] = React.useState<string | boolean>(false)
  const [dataColumns, setDataColumns] = React.useState<string[]>([])
  const [dataTable, _setDataTable] = React.useState<object[]>([])
  const [svgHtml, _setSvgHtml] = React.useState('')
  const [resize, setResize] = React.useState(false)
  const [chartWidth, setWidth] = React.useState(500)
  const [chartHeight, setHeight] = React.useState(500)
  let editor: any = null
  const editorRef = (i: any) => editor = i || editor

  const tryRenderTmplt = (m: (string | boolean), j: any, d: object[]) => {
    if (m !== 'tmplt' || !d.length || !j) {
      return
    }
    setSvgHtml('')
    const dataset = {
      name: 'demo',
      tables: j.tables.map((table: any) => {
        return {
          rows: d,
          ...table
        }
      })
    }
    try {
      const stateManager = new ChartStateManager(j.specification, dataset, null, j.defaultAttributes)
      stateManager.solveConstraints()
      renderChartToLocalString(dataset, j.specification, stateManager.chartState).then(v => setSvgHtml(v))
    } catch {
    }
  }

  const setDataTable = (v: any) => {
    tryRenderTmplt(mode, json, v)
    _setDataTable(v)
  }

  const setSvgHtml = (v: any) => {
    function outerStyle(node: any) {
      if (!(node instanceof SVGElement || node instanceof HTMLElement)) return
      let styles: string = node.getAttribute('style') || ''
      let styleList = styles.split(';').filter(x => x.trim()).map(x => x.split(':'))
      for (let style of styleList) {
        node.setAttribute(style[0].trim(), style[1].trim())
      }
      node.setAttribute('style', '')
      if (node.childNodes.length) {
        node.childNodes.forEach((child: any) => outerStyle(child))
      }
      // remove empty attributes
      for (let name of node.getAttributeNames()) {
        if (!node.getAttribute(name).trim()) {
          node.removeAttribute(name)
        }
      }
    }
    let tmpDiv = document.createElement('div')
    tmpDiv.innerHTML = v
    outerStyle(tmpDiv)
    _setSvgHtml(tmpDiv.innerHTML)
  }

  useEffect(() => {
    setJson(json, false)
  }, [resize, chartWidth, chartHeight])

  const setJson = (v: any, f = true) => {
    if (v.state && v.name) {
      setMode('chart')
      const tmp = JSON.parse(JSON.stringify(v))
      if (resize) {
        tmp.state.chart.mappings = {
          ...tmp.state.chart.mappings,
          width: {
            type: 'value',
            value: chartWidth
          },
          height: {
            type: 'value',
            value: chartHeight
          }
        }
        const stateManager = new ChartStateManager(tmp.state.chart, tmp.state.dataset, tmp.state.chartState)
        stateManager.solveConstraints()
        renderChartToLocalString(stateManager.dataset, stateManager.chart, stateManager.chartState).then(v => setSvgHtml(v))
      } else
        renderChartToLocalString(v.state.dataset, v.state.chart, v.state.chartState).then(v => setSvgHtml(v))
    } else if (v.specification && v.defaultAttributes && v.tables && v.inference && v.properties) {
      setMode('tmplt')
      tryRenderTmplt('tmplt', v, dataTable)
    } else if ((v.$schema || '').includes('vega.github.io/schema')) {
      setMode('vega')
      const view: any = new vega.View(vega.parse(v), { renderer: 'none' })
      view.toSVG().then((v: string) => setSvgHtml(v))
    } else
      setMode(false)
    f && editor.jsonEditor.set(v)
    setSvgHtml('')
    _setJson(v)
  }

  const editorSetJson = (v: any) => setJson(v, false)

  const props = {
    name: 'file',
    accept: '.chart,.tmplt,.csv,.json',
    action: '/',
    showUploadList: false,
    beforeUpload(e: File) {
      let reader = new FileReader()
      reader.onload = () => {
        if (e.name.endsWith('.chart') || e.name.endsWith('.tmplt') || e.name.endsWith('.json')) {
          try {
            setJson(JSON.parse(reader.result as string))
          } catch{ }
        } else if (e.name.endsWith('.csv')) {
          csv({
            checkType: true
          }).fromString(reader.result as string).on('header', e => setDataColumns(e)).then(e => setDataTable(e))
        }
      }
      reader.readAsText(e)
      return false
    }
  };

  function download() {
    var blob = new Blob([svgHtml], { type: 'text/plain' });
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, 'output.dsvg');
    }
    else {
      var elem = window.document.createElement('a');
      elem.href = window.URL.createObjectURL(blob);
      elem.download = 'output.dsvg';
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
    }
  }

  return (
    <div id="app">
      <div>
        <Dragger {...props}>
          <p className="ant-upload-drag-icon">
            <Icon type="inbox" />
          </p>
          <p className="ant-upload-text">Click or drag file here to read</p>
        </Dragger>
        <div className="json-editor">
          <JsonEditor ref={editorRef} mode='code' allowedModes={['code', 'tree']} ace={ace} value={json} onChange={editorSetJson}></JsonEditor>
        </div>
        {
          mode !== 'chart' && mode !== 'vega' &&
          <div className="dataset">
            {
              dataColumns.length ?
                <table>
                  <thead>
                    <tr>
                      {dataColumns.map(key => <th>{key}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dataTable.map((row: any) => <tr>{dataColumns.map(key => <td>{row[key]}</td>)}</tr>)}
                  </tbody>
                </table>
                :
                <p className="hint">No dataset loaded.</p>
            }
          </div>
        }
      </div>
      <div>
        <Button disabled={!svgHtml} type="primary" icon="download" onClick={download}>Download</Button>
        {
          mode !== 'vega' &&
          <div>
            <Switch onChange={setResize} />
            <span>Resize Chart to</span>
            <InputNumber defaultValue={500} onChange={setWidth} size="small" />
            <span>&times;</span>
            <InputNumber defaultValue={500} onChange={setHeight} size="small" />
          </div>
        }
        <div className="svg-container" dangerouslySetInnerHTML={{ __html: svgHtml }}></div>
      </div>
    </div>
  );
}

export default App;
