const path = require('path')
const originalRequire = window.require // Preserve the original require function
// Override the require function to search in both original NODE_PATH and custom directory
window.require = <any>(function (modulePath: string) {
    let result
    try {
        // First, try to require the module using the original require function
        result = originalRequire(modulePath)
    } catch (e) {
        // If the module is not found, try to require it from the custom directory
        const customModulePath = path.join(__dirname, modulePath)
        result = originalRequire(customModulePath)
    }
    return result
})
