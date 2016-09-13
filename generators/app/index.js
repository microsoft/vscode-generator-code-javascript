'use strict';

const generators = require('yeoman-generator');
const fs = require('fs');
const cp = require('child_process');
const yosay = require('yosay');

module.exports = generators.Base.extend({

    constructor: function () {
        generators.Base.apply(this, arguments);

        this.argument('codeExec', { type: String, defaults: 'code-insiders', optional: true });
        this.ctx = Object.create(null);
    },

    // --- init ------------

    _checkConfigJson() {
        // check/fetch jsconfig.json
        this.ctx.jsConfigJson = this.fs.readJSON(this.destinationPath('jsconfig.json'))
        this.ctx.tsConfigJson = this.fs.readJSON(this.destinationPath('tsconfig.json'))
    },

    _checkTypesDependencies() {
        // check/fetch package.json

        const pack = this.fs.readJSON(this.destinationPath('package.json'))
        if (pack) {
            const dependencies = new Set();
            const typeDependencies = new Set();

            const visit = (properties) => {
                if (properties) {
                    for (let name in properties) {
                        if (name.indexOf('@types') === -1) {
                            dependencies.add(name);
                        } else {
                            typeDependencies.add(name);
                        }
                    }
                }
            }

            visit(pack.dependencies);
            visit(pack.devDependencies);
            visit(pack.optionalDependencies);

            pack.optionalDependencies = pack.optionalDependencies || {};

            for (const dep of dependencies) {
                const typeDep = `@types/${dep}`;
                if (!typeDependencies.has(typeDep)) {
                    pack.optionalDependencies[typeDep] = '*';
                    this.ctx.newPackageJson = pack;
                }
            }
        }
    },
    _checkInstalledExtensions() {
        // code-extensions
        const resolve = this.async();
        
        cp.exec(`${this.codeExec} --list-extensions`, (err, stdout, stderr) => {
            if (!err) {
                this.ctx.installedExtensions = new Set(stdout.trim().split(/[\r\n]/));
            }
            resolve();
        });
    },

    initializing() {

        this.log(yosay('Welcome to the JavaScript project assistant!'));

        this._checkConfigJson();
        this._checkTypesDependencies();
        this._checkInstalledExtensions();
    },

    prompting() {
        const prompts = [
            {
                when: () => !this.ctx.jsConfigJson && !this.ctx.tsConfigJson,
                type: 'confirm',
                name: 'createJsConfig',
                message: 'Create \'jsconfig.json\' file?',
            },
            {
                when: () => this.ctx.tsConfigJson && (!this.ctx.tsConfigJson.compilerOptions || !this.ctx.tsConfigJson.compilerOptions.allowJs),
                type: 'confirm',
                name: 'setAllowJs',
                message: 'Should I adjust \'tsconfig.json\' to allow for JavaScript files (strongly recommended)?',
            },
            {
                when: answers => !answers.setAllowJs && this.ctx.tsConfigJson && (!this.ctx.tsConfigJson.compilerOptions || !this.ctx.tsConfigJson.compilerOptions.allowJs),
                type: 'confirm',
                name: 'setAllowJs',
                message: 'Sure about that? The presence of a \'tsconfig.json\'-file shadows a \'jsconfig.json\'-file and without the \'allowJs\'-flag there will be no support for JavaScript. Should I add the \'allowJs\'-flag?',
            },
            {
                when: () => this.ctx.newPackageJson,
                type: 'confirm',
                name: 'acquireTypes',
                message: 'Install type-definition files (.d.ts) and adjust \'package.json\'?'
            },
            {
                when: () => this.ctx.installedExtensions && !this.ctx.installedExtensions.has('eg2.vscode-npm-script'),
                type: 'confirm',
                name: 'installNpmScriptRunner',
                message: 'Install \'npm script runner\'-extension?'
            },
            {
                when: () => this.ctx.installedExtensions && !this.ctx.installedExtensions.has('dbaeumer.vscode-eslint'),
                type: 'confirm',
                name: 'installEsLint',
                message: 'Install \'eslint\'-extension?'
            }
        ];
        const resolve = this.async();
        this.prompt(prompts, answers => {
            this.answers = answers;
            resolve();
        });
    },

    writing() {
        if (this.answers.createJsConfig) {
            // write jsconfig
            this.fs.copy(this.templatePath('jsconfig.json'), this.destinationPath('jsconfig.json'));

        } else if (this.answers.setAllowJs) {
            // update tsconfig
            if (!this.ctx.tsConfigJson.compilerOptions) {
                this.ctx.tsConfigJson.compilerOptions = { allowJs: true };
            } else {
                this.ctx.tsConfigJson.compilerOptions.allowJs = true;
            }
            fs.writeFileSync(this.destinationPath('tsconfig.json'), JSON.stringify(this.ctx.tsConfigJson, undefined, 4));
        }

        // update package.json
        if (this.answers.acquireTypes) {
            fs.writeFileSync(this.destinationPath('package.json'), JSON.stringify(this.ctx.newPackageJson, undefined, 4));
            // this.fs.writeJSON(this.destinationPath('package.json'), this.ctx.newPackageJson, undefined, 4);
        }

        // add .eslintrc file
        if (this.answers.installEsLint) {
            this.fs.copy(this.templatePath('eslintrc.json'), this.destinationPath('.eslintrc'));
        }
    },

    install() {

        if (this.answers.acquireTypes) {
            this.installDependencies({ bower: false });
        }

        if (this.answers.installNpmScriptRunner) {
            this.spawnCommand(this.codeExec, ['--install-extension', 'eg2.vscode-npm-script']);
        }

        if (this.answers.installEsLint) {
            this.spawnCommand(this.codeExec, ['--install-extension', 'dbaeumer.vscode-eslint']);
        }
    }
});